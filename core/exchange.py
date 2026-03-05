import ccxt.pro as ccxtpro
import asyncio
import pandas as pd
import numpy as np
from core.logger import logger
from core.config import CONFIG, BINANCE_API_KEY, BINANCE_API_SECRET

class ExchangeManager:
    def __init__(self):
        self.exchange_id = CONFIG['trading']['exchange']
        
        # İlgili borsa sınıfını ccxt.pro'dan bul
        if not hasattr(ccxtpro, self.exchange_id):
            logger.error(f"Desteklenmeyen borsa: {self.exchange_id}")
            raise ValueError(f"Desteklenmeyen borsa: {self.exchange_id}")
            
        self.exchange_class = getattr(ccxtpro, self.exchange_id)
        self.download_stops = {} # {symbol: bool} - İndirmeyi durdurmak için
        self.download_pauses = {} # {symbol: bool} - Duraklatmak için
        self.active_downloads = {} # {symbol: metadata} - Aktif görevleri takip etmek için
        
        # Borsa parametrelerini hazırla
        exchange_args = {
            'enableRateLimit': True, # Borsa kurallarına göre hızı sınırlar (Ban yememek için)
            'options': {
                'defaultType': 'future', # Vadeli işlemler için
            }
        }
        
        # Seçili borsaya göre API anahtarlarını çek (.env dosyasından)
        if self.exchange_id == 'binance':
            if BINANCE_API_KEY and BINANCE_API_SECRET:
                exchange_args['apiKey'] = BINANCE_API_KEY
                exchange_args['secret'] = BINANCE_API_SECRET
            else:
                logger.warning("Binance API bilgileri bulunamadı (.env)! Sadece genel piyasa izlemesi (Ticker) yapılacak, Emir verilemez.")
            
        # Asenkron borsayı başlat
        self.exchange = self.exchange_class(exchange_args)
        logger.info(f"{self.exchange_id.upper()} borsa motoru WebSocket desteğiyle başlatıldı.")

    async def load_tasks_from_db(self):
        """Uygulama başladığında yarım kalan görevleri veritabanından hafızaya geri yükler ve indirmeyi başlatır."""
        from data.database import db_manager
        tasks = await db_manager.get_all_download_tasks()
        count = 0
        for t in tasks:
            # Sadece bitmemiş olanları alıyoruz
            if t['status'] in ['running', 'paused']:
                m_type = t['market_type'].lower()
                key = f"{t['symbol']}_{m_type}"
                
                # Metadata yükle (UI için)
                self.active_downloads[key] = dict(t)
                self.download_stops[key] = False
                self.download_pauses[key] = (t['status'] == 'paused')
                
                # Arka plan görevini (coroutine) gerçekten başlat
                asyncio.create_task(self.download_historical_data(
                    t['symbol'], 
                    t['timeframe'], 
                    t['start_date'], 
                    m_type,
                    is_resume=True
                ))
                count += 1
        logger.info(f"📁 {count} yarım kalan indirme görevi veritabanından geri yüklendi ve BAŞLATILDI.")

    async def fetch_ohlcv(self, symbol, timeframe='1m', limit=100, params={}):
        """Asenkron olarak geçmiş mum verilerini (REST API ile) çeker"""
        try:
            data = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit, params=params)
            return data
        except Exception as e:
            logger.error(f"OHLCV Çekme Hatası ({symbol}): {e}")
            return []

    async def fetch_available_markets(self):
        """Borsadaki tüm aktif işlem çiftlerini (Spot ve Vadeli) çeker."""
        try:
            # Hem Vadeli (Future) hem Spot piyasaları yükleyelim (Binance için kritik)
            if not self.exchange.markets:
                logger.info("Marketler henüz yüklenmemiş, Binance'ten çekiliyor...")
                try:
                    await self.exchange.load_markets({'type': 'future'})
                    await self.exchange.load_markets({'type': 'spot'})
                except Exception as auth_err:
                    # EĞER API ANAHTARI HATALIYSA (Code -2008), Anahtarları silip anonim dene
                    if "AuthenticationError" in str(type(auth_err)) or "-2008" in str(auth_err):
                        logger.warning("Binance API anahtarları geçersiz! Anonim moda (Public) geçiliyor...")
                        self.exchange.apiKey = None
                        self.exchange.secret = None
                        # Tekrar dene (Bu sefer şifresiz)
                        await self.exchange.load_markets({'type': 'future'})
                        await self.exchange.load_markets({'type': 'spot'})
                    else:
                        raise auth_err
            
            markets = self.exchange.markets
            logger.info(f"Borsadan toplam {len(markets) if markets else 0} ham market verisi çekildi.")
            
            available = []
            for symbol, m in markets.items():
                # Sadece aktif ve USDT bazlı olanları alalım
                if m.get('active') and m.get('quote') == 'USDT':
                    m_type = (m.get('type') or 'spot').lower()
                    m_sub_type = (m.get('subType') or '').lower()
                    
                    # Kullanıcı dostu etiketleme sistemi
                    display_type = "SPOT"
                    if m_type == 'swap' or m_sub_type == 'perpetual':
                        display_type = "SÜRESİZ VADELİ (PERP)"
                    elif m_type == 'future' or m_sub_type == 'delivery':
                        display_type = f"TARİHLİ VADELİ ({m.get('info', {}).get('deliveryDate', 'DUR')})"
                    
                    available.append({
                        'symbol': symbol,
                        'base': m['base'],
                        'type': display_type,
                        'id': m['id'], # Bu ham Binance ID'sidir (BTCUSDT, ETHUSDT vb.)
                        'raw_type': m_type
                    })
            
            logger.info(f"Filtreleme sonrası (Active + USDT) {len(available)} market listeye eklendi.")
            return sorted(available, key=lambda x: (x['symbol'], x['type']))
        except Exception as e:
            logger.error(f"Market Listesi Çekme Hatası: {e}")
            return []

    async def watch_ticker_loop(self, symbol):
        """WebSocket üzerinden gerçek zamanlı anlık fiyat dinleyicisi"""
        from core.paper import paper_engine # Loop delayı önlemek için içe aktarıldı
        
        logger.info(f"{symbol} için WebSocket Ticker akışı başlatıldı.")
        while True:
            try:
                # Gerçek zamanlı itme (push) teknolojisi ile anlık veriyi çek
                ticker = await self.exchange.watch_ticker(symbol)
                current_price = ticker['last']
                
                # Sanal Ticaret (Paper Trade) Modülü - Açık pozisyonları canlı saniyede güncelle
                await paper_engine.update_live_prices(symbol, current_price)
                
                # Terminal kirletilmemesi için artık debug'a basmıyoruz
                # logger.debug(f"[WS] {symbol} Fiyat: {current_price}, Hacim: {ticker['baseVolume']}")
            except asyncio.CancelledError:
                logger.info(f"Ticker dinleme işlemi sonlandırıldı ({symbol}).")
                break
            except Exception as e:
                logger.error(f"WS Ticker İzleme Hatası ({symbol}): {e}")
                await asyncio.sleep(5)  # Hata durumunda bağlantıyı 5sn soğut

    async def download_historical_data(self, symbol, timeframe='1m', start_date_str="2024-01-01", market_type='future', is_resume=False):
        """Belirli bir tarihten itibaren eksik olan tüm mum verilerini indirir."""
        from data.database import db_manager
        import datetime
        
        # Piyasa tipini standardize et (Swap/Perp -> Future)
        market_type = 'future' if market_type.lower() in ['future', 'swap', 'perp', 'perpetual'] else 'spot'
        
        # Market bilgilerini tazele (Hataları önlemek için kritik)
        if not self.exchange.markets or symbol not in self.exchange.markets:
            try:
                await self.exchange.load_markets({'type': market_type})
            except Exception as auth_err:
                # EĞER API ANAHTARI HATALIYSA (Code -2008), Anahtarları silip anonim dene
                if "AuthenticationError" in str(type(auth_err)) or "-2008" in str(auth_err):
                    logger.warning(f"⚠️ {symbol} indirme hatası: Binance API anahtarları geçersiz! Anonim moda geçiliyor...")
                    self.exchange.apiKey = None
                    self.exchange.secret = None
                    await self.exchange.load_markets({'type': market_type})
                else:
                    raise auth_err
            
        # Tarihi UTC olarak işle (Zaman dilimi kaymalarını önlemek için kritik)
        target_start_ts = pd.to_datetime(start_date_str).tz_localize('UTC') if not pd.to_datetime(start_date_str).tzinfo else pd.to_datetime(start_date_str).tz_convert('UTC')
        target_start_ms = int(target_start_ts.timestamp() * 1000)
        
        # Benzersiz görev anahtarı oluştur (Aynı sembolün spot ve vadelisini ayırmak için)
        key = f"{symbol}_{market_type}"
        
        # Eğer bu işlem sıfırdan bir başlatmaysa (Kullanıcı yeni tarih seçtiyse),
        # Veritabanındaki son tarihe atlamayı DEVRE DIŞI bırakıyoruz.
        if is_resume and key in self.active_downloads and self.active_downloads[key].get('current_ts', 0) > target_start_ms:
            since = self.active_downloads[key]['current_ts']
            logger.info(f"🔄 {key} indirme işlemi kaldığı yerden DEVAM EDİYOR: {pd.to_datetime(since, unit='ms')}")
        else:
            since = target_start_ms
            logger.info(f"✨ {key} indirme işlemi SIFIRDAN / İSTENEN TARİHTEN başlatıldı: {pd.to_datetime(since, unit='ms')}")

        all_downloaded = 0
        limit = 1000 # Binance tek seferde max 1000 mum verir
        
        logger.info(f"🚀 {key} ({timeframe}) indirme BAŞLADI: {pd.to_datetime(since, unit='ms')}")
        self.download_stops[key] = False
        self.download_pauses[key] = False
        self.active_downloads[key] = {
            'symbol': symbol,
            'timeframe': timeframe,
            'market_type': market_type,
            'start_date': start_date_str,
            'since': since,
            'current_ts': since,
            'target_start_ms': target_start_ms,
            'status': 'running'
        }
        await db_manager.save_download_task(self.active_downloads[key])
        
        while True:
            try:
                # Kullanıcı durdurdu mu?
                if self.download_stops.get(key):
                    logger.info(f"🛑 {key} indirme işlemi kullanıcı tarafından DURDURULDU.")
                    if key in self.active_downloads:
                        self.active_downloads[key]['status'] = 'stopped'
                        await db_manager.save_download_task(self.active_downloads[key])
                    break
                
                # Kullanıcı duraklattı mı?
                while self.download_pauses.get(key):
                    if key in self.active_downloads and self.active_downloads[key]['status'] != 'paused':
                        self.active_downloads[key]['status'] = 'paused'
                        await db_manager.save_download_task(self.active_downloads[key])
                    await asyncio.sleep(2) # 2 saniyede bir duraklatma kontrolü yap
                
                if key not in self.active_downloads:
                    break # Görev silinmişse döngüden çık
                
                self.active_downloads[key]['status'] = 'running'
                
                # CCXT rates limitine göre fetch yap
                ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit, params={'type': market_type})
                
                if not ohlcv or len(ohlcv) < 1:
                    logger.info(f"🏁 {symbol} için borsa artık veri dönmüyor (Son Tarih: {pd.to_datetime(since, unit='ms')}).")
                    break
                
                # Veritabanına toplu kayıt
                for candle in ohlcv:
                    await db_manager.save_kline(symbol, candle, timeframe=timeframe)
                
                last_ts = ohlcv[-1][0]
                all_downloaded += len(ohlcv)
                
                # Her 5000 mumda bir ana log bas (Terminali kirletmeden takip sağla)
                if all_downloaded % 5000 == 0:
                    logger.info(f"📥 {symbol} İlerleme: {all_downloaded} mum kaydedildi... [Şu anki Tarih: {pd.to_datetime(last_ts, unit='ms')}]")
                else:
                    logger.debug(f"📥 {symbol} {len(ohlcv)} mum indirildi. Son: {pd.to_datetime(last_ts, unit='ms')}")
                
                # Eğer son gelen mum anlık zamana çok yakınsa dur
                import time
                now_ms = int(time.time() * 1000)
                if last_ts >= now_ms - 60000:
                    logger.info(f"🎯 {symbol} indirme işlemi güncel zamana (UTC) ulaştı.")
                    break
                    
                since = last_ts + 1
                if key in self.active_downloads:
                    self.active_downloads[key]['current_ts'] = last_ts
                    # Her batch sonrası DB'yi güncelle (ilerleme kaydı)
                    await db_manager.save_download_task(self.active_downloads[key])
                await asyncio.sleep(0.02) # Hızlandırıldı
                
            except Exception as e:
                logger.error(f"⚠️ {symbol} Veri İndirme Döngüsünde Hata: {e}")
                await asyncio.sleep(5)
                
        is_stopped = self.download_stops.get(key, False)
        
        if is_stopped:
            logger.info(f"⏸️ {key} Veri İndirme Görevi Beklemeye / İptal Edilmeye Alındı. Toplam {all_downloaded} yeni veri eklendi.")
            if key in self.active_downloads:
                del self.active_downloads[key]
        else:
            logger.info(f"✅ {key} Veri İndirme TAMAMLANDI. Toplam {all_downloaded} yeni veri eklendi.")
            if key in self.active_downloads:
                self.active_downloads[key]['status'] = 'completed'
                await db_manager.save_download_task(self.active_downloads[key])
                del self.active_downloads[key]
                
        return all_downloaded
                
    async def run_strategy_poller(self, symbol, timeframe='1m'):
        """
        Gelişmiş Strateji Motoru:
        1. Daima 1m (en hassas) mumları indirir.
        2. Pariteye atanmış hedef vadeye (Örn: 15m) göre verileri yeniden paketler (Resampling).
        3. Sadece 'Vade Kapanışında' stratejiyi çalıştırır (Yanıltıcı sinyalleri önler).
        4. GMT+3 uyumlu zamanlama kontrolü yapar.
        """
        from core.paper import paper_engine
        from data.indicators import StrategyIndicators
        from data.features import AdvancedFeatures
        from core.detector import MarketRegimeDetector
        import pickle
        import os
        import time

        # Eğitilmiş modeli yükle
        xgb_model = None
        model_path = "artifacts/trained_models/xgb_model.pkl"
        if os.path.exists(model_path):
            with open(model_path, 'rb') as f:
                xgb_model = pickle.load(f)
                logger.info(f"🧠 {symbol} için Karar Zekası (XGBoost) hazır.")

        # Zaman dilimi kontrolü için yardımcı
        def get_tf_minutes(tf_str):
            if 'm' in tf_str: return int(tf_str.replace('m', ''))
            if 'h' in tf_str: return int(tf_str.replace('h', '')) * 60
            if 'd' in tf_str: return 1440
            return 1

        def get_higher_tf(tf_str):
            tf_map = {
                '1m': '15m',
                '3m': '15m',
                '5m': '30m',
                '15m': '1h',
                '30m': '4h',
                '1h': '4h',
                '4h': '1d'
            }
            return tf_map.get(tf_str, '4h')

        last_processed_ts = 0
        is_first_run = True # İlk açılışta veya strateji değişiminde anında bir kere çalıştır

        while True:
            try:
                # 1. Hedef Vadeyi Öğren
                target_tf = paper_engine.active_timeframes.get(symbol, '1m')
                tf_minutes = get_tf_minutes(target_tf)
                
                # 2. Mum Kapanış Kontrolü (Hassas Zamanlama)
                current_timestamp_min = int(time.time() / 60)
                
                # İlk çalışma değilse ve vade henüz dolmadıysa bekle
                if not is_first_run and current_timestamp_min % tf_minutes != 0:
                    await asyncio.sleep(10)
                    continue
                
                # Aynı mumda mükerrer işlem yapma (Ancak ilk çalışmada buna izin ver)
                if not is_first_run and current_timestamp_min == last_processed_ts:
                    await asyncio.sleep(20)
                    continue
                
                # İlk çalışma bariyeri aşıldı
                if is_first_run:
                    logger.info(f"🚀 {symbol} için ilk strateji taraması başlatılıyor ({target_tf})...")
                    is_first_run = False

                # 3. Veri Çek ve Yeniden Örnekle (Resample)
                # İndikatörler için yeterli veri çekelim (Binance MAX limit 1500 mum)
                ohlcv_1m = await self.fetch_ohlcv(symbol, timeframe='1m', limit=1500)
                
                if not ohlcv_1m:
                    await asyncio.sleep(10)
                    continue

                df_1m = pd.DataFrame(ohlcv_1m, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                
                # 4. HEDEF VADEYE DÖNÜŞTÜR (Resampling Engine)
                df_target = StrategyIndicators.resample_data(df_1m, target_tf)
                
                # 5. ÜST ZAMAN DİLİMİ (HTF) TEYİDİ
                htf_tf = get_higher_tf(target_tf)
                df_htf = StrategyIndicators.resample_data(df_1m, htf_tf)
                df_htf = StrategyIndicators.add_all_indicators(df_htf)
                
                htf_trend = "NEUTRAL"
                if not df_htf.empty and 'EMA_50' in df_htf.columns:
                    htf_last = df_htf.iloc[-1]
                    val_c = htf_last.get('close')
                    val_e = htf_last.get('EMA_50')
                    
                    if val_c is not None and val_e is not None and not np.isnan(val_c) and not np.isnan(val_e):
                        if val_c > val_e:
                            htf_trend = "BULL"
                        elif val_c < val_e:
                            htf_trend = "BEAR"
                
                # 6. İndikatörleri Hesapla (Hedef Vade Üzerinden)
                df_target = StrategyIndicators.add_all_indicators(df_target)
                df_target['volatility_ema'] = AdvancedFeatures.get_volatility(df_target['close'], span=20)
                df_target.ffill(inplace=True); df_target.bfill(inplace=True)
                
                if not df_target.empty:
                    current_price = df_target.iloc[-1]['close']
                    last_processed_ts = current_timestamp_min
                    
                    # 7. MARKET REGİME (PİYASA REJİMİ) TESPİTİ
                    regime_info = MarketRegimeDetector.detect_regime(df_target)
                    paper_engine.market_regime = regime_info['regime'] # Global durum güncellemesi
                    logger.debug(f"Exchange Poller paper_engine ID: {id(paper_engine)}, updated regime to: {regime_info['regime']}")
                    
                    # 8. YAPAY ZEKA TAHMİNİ (Hedef Vade Verileriyle)
                    ml_confidence = 0.50
                    if xgb_model:
                        try:
                            feature_cols = [
                                'open', 'high', 'low', 'close', 'volume', 
                                'SMA_20', 'EMA_50', 'RSI_14', 
                                'MACD_12_26_9', 'MACDs_12_26_9', 'MACDh_12_26_9',
                                'ATR_14', 'BBU_20_2.0_2.0', 'BBL_20_2.0_2.0', 'VWAP', 'volatility_ema'
                            ]
                            # Sadece mevcut kolonları seç
                            valid_cols = [c for c in feature_cols if c in df_target.columns]
                            last_row = df_target[valid_cols].iloc[[-1]].fillna(0)
                            
                            if len(valid_cols) == len(feature_cols):
                                probs = xgb_model.predict_proba(last_row)
                                ml_confidence = float(np.max(probs[0]))
                            else:
                                logger.warning(f"⚠️ {symbol} için eksik feature kolonları var. Skips ML.")
                        except Exception as e:
                            logger.error(f"ML Tahmin Hatası ({symbol}): {e}")
                    else:
                        import random
                        ml_confidence = random.uniform(0.6, 0.9)

                    # 9. SİNYAL İŞLEME VE KAĞIT TİCARETİ (HTF Trendi + Market Regime Dahil Edildi)
                    await paper_engine.process_signal(symbol, current_price, df_target, ml_confidence, 
                                               htf_trend=htf_trend, regime=regime_info['regime'])
                    logger.info(f"✅ {symbol} {target_tf} (HTF: {htf_trend} | REJİM: {regime_info['regime']}) analiz tamamlandı.")

                # Bir sonraki kontrol için bekle
                await asyncio.sleep(30)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                import traceback
                logger.error(f"Strateji Döngü Hatası ({symbol}): {e}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(10)

    async def close(self):
        """Borsa bağlantılarını ve WebSocket akışlarını temiz bir şekilde kapatır."""
        if self.exchange:
            await self.exchange.close()
            logger.info(f"{self.exchange_id.upper()} borsa bağlantısı sonlandırıldı.")

# Diğer modüllerden kolay erişim için Singleton mantığı
exchange_manager = ExchangeManager()
