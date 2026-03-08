import ccxt.pro as ccxtpro
import asyncio
import pandas as pd
import numpy as np
from core.logger import logger
from core.config import CONFIG, BINANCE_API_KEY, BINANCE_API_SECRET

# WFO Engine import (opsiyonel - WFO aktifse)
try:
    from core.wfo_engine import get_wfo_engine, start_wfo_background_task
    WFO_AVAILABLE = True
except ImportError:
    WFO_AVAILABLE = False
    logger.warning("⚠️ WFO Engine bulunamadı, optimizasyon özellikleri devre dışı.")

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

        # YENİ: Aktif poller'ları takip et (1-to-N mimarisi)
        self.active_pollers = {} # {symbol: asyncio.Task} - Her sembol için 1 poller
        
        # Borsa parametrelerini hazırla
        exchange_args = {
            'enableRateLimit': True, # Borsa kurallarına göre hızı sınırlar (Ban yememek için)
            'timeout': 60000, # 60 saniye timeout (Oracle Cloud için artırıldı)
            'options': {
                'defaultType': 'future', # Vadeli işlemler için
                'recvWindow': 60000, # 60 saniye receive window
            }
        }

        # Seçili borsaya göre API anahtarlarını çek (.env dosyasından)
        if self.exchange_id == 'binance':
            if BINANCE_API_KEY and BINANCE_API_SECRET:
                exchange_args['apiKey'] = BINANCE_API_KEY
                exchange_args['secret'] = BINANCE_API_SECRET
                logger.info("✅ Binance API anahtarları yüklendi. Yüksek rate limit aktif.")
            else:
                logger.warning("Binance API bilgileri bulunamadı (.env)! Sadece genel piyasa izlemesi (Ticker) yapılacak, Emir verilemez.")
                logger.warning("⚠️ Rate limit düşük olacak. API key eklemek için .env dosyasını düzenleyin.")
            
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
            # API key hatası varsa, anonim moda geç ve tekrar dene
            if "-2008" in str(e) or "AuthenticationError" in str(type(e)):
                logger.warning(f"⚠️ {symbol} API key hatası! Anonim moda geçiliyor...")
                self.exchange.apiKey = None
                self.exchange.secret = None
                try:
                    data = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit, params=params)
                    return data
                except Exception as retry_err:
                    logger.error(f"OHLCV Çekme Hatası ({symbol}): {retry_err}")
                    return []
            else:
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
        """
        WebSocket üzerinden gerçek zamanlı anlık fiyat dinleyicisi.

        ADIM 4 ENTEGRASYONU:
        - WebSocket'ten ticker alır
        - Açık pozisyon varsa paper_engine.update_live_prices() çağırır
        - Bu metod içinde update_trailing_stop() ve check_exit_condition() çalışır
        """
        from core.paper import paper_engine # Loop delayı önlemek için içe aktarıldı

        logger.info(f"{symbol} için WebSocket Ticker akışı başlatıldı.")
        while True:
            try:
                # Gerçek zamanlı itme (push) teknolojisi ile anlık veriyi çek
                ticker = await self.exchange.watch_ticker(symbol)
                current_price = ticker['last']

                # === ADIM 4: TRAILING STOP ENTEGRASYONU ===
                # Açık pozisyonları kontrol et ve trailing stop güncelle
                # update_live_prices() içinde:
                #   1. update_trailing_stop() - Trailing stop güncelleme
                #   2. check_exit_condition() - Stop patlama kontrolü
                if symbol in [pos['symbol'] for pos in paper_engine.open_positions]:
                    # Sadece açık pozisyon varsa güncelle (performans optimizasyonu)
                    await paper_engine.update_live_prices(symbol, current_price)
                    # Not: current_price hem high hem low olarak kullanılıyor
                    # Gelecek iyileştirme: 1m mum high/low kullanmak için fetch_ohlcv gerekebilir

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

        # Sembol ismini temizle (Giriş parametresi kirli gelmiş olabilir: BTC/USDT_spot gibi)
        symbol = symbol.split('_')[0].strip()
        
        # Piyasa tipini standardize etme işlemi API katmanında yapıldığı için burada tekrar yapılmaz.
        
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
                # NOT: params={'type': market_type} API key gerektiriyor, bu yüzden kaldırdık
                # API key yoksa otomatik olarak public endpoint kullanılır
                try:
                    ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
                except Exception as fetch_err:
                    # Binance rate limit veya network hatası
                    logger.warning(f"⚠️ {symbol} veri çekme hatası: {fetch_err}")
                    logger.info(f"⏳ 10 saniye bekleniyor...")
                    await asyncio.sleep(10)
                    continue

                if not ohlcv or len(ohlcv) < 1:
                    logger.info(f"🏁 {symbol} için borsa artık veri dönmüyor (Son Tarih: {pd.to_datetime(since, unit='ms')}).")
                    break
                
                # Veritabanına toplu kayıt (her mum için ayrı INSERT yerine batch)
                klines_to_save = []
                for candle in ohlcv:
                    klines_to_save.append((symbol, candle, timeframe))

                # Toplu kayıt (tek transaction içinde)
                try:
                    for kline_data in klines_to_save:
                        await db_manager.save_kline(*kline_data)
                except Exception as db_err:
                    logger.error(f"⚠️ {symbol} DB yazma hatası: {db_err}")
                    # Locked hatası varsa 5 saniye bekle ve tekrar dene
                    if "database is locked" in str(db_err):
                        logger.warning(f"⏳ Database locked, 5 saniye bekleniyor...")
                        await asyncio.sleep(5)
                        # Tekrar dene
                        for kline_data in klines_to_save:
                            try:
                                await db_manager.save_kline(*kline_data)
                            except Exception:
                                pass  # İkinci hata durumunda devam et

                last_ts = ohlcv[-1][0]
                all_downloaded += len(ohlcv)

                # Her 5000 mumda bir DB güncelle (daha az locked hatası)
                if all_downloaded % 5000 == 0:
                    logger.info(f"📥 {symbol} İlerleme: {all_downloaded} mum kaydedildi... [Şu anki Tarih: {pd.to_datetime(last_ts, unit='ms')}]")
                    # DB görevini güncelle
                    if key in self.active_downloads:
                        self.active_downloads[key]['current_ts'] = last_ts
                        try:
                            await db_manager.save_download_task(self.active_downloads[key])
                        except Exception as db_err:
                            logger.warning(f"⚠️ DB güncelleme hatası (devam ediliyor): {db_err}")
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

                # Dinamik sleep: Her 5000 mumda bir daha uzun bekle (rate limit ve DB locked önleme)
                if all_downloaded % 5000 == 0:
                    await asyncio.sleep(2)  # Her 5000 mumda bir 2 saniye bekle
                else:
                    await asyncio.sleep(0.1)  # Normalde 100ms yeterli
                
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

    async def _process_bot_task(self, paper_engine, bot_id: str, df: pd.DataFrame, current_price: float, htf_trend: str, regime: str):
        """
        Tek bir bot için sinyal işleme task'ı (async, izole, hata korumalı).

        Args:
            paper_engine: PaperTrader instance
            bot_id: İşlenecek bot ID
            df: İndikatörlerle DataFrame
            current_price: Güncel fiyat
            htf_trend: Yüksek timeframe trend
            regime: Piyasa rejimi
        """
        try:
            # Bot sinyal işleme (ASYNC - await ile bekle)
            await paper_engine.process_bot_signal(
                bot_id=bot_id,
                df=df,
                current_price=current_price,
                htf_trend=htf_trend,
                regime=regime
            )
        except Exception as e:
            logger.error(f"❌ [BOT TASK] {bot_id} işlem hatası: {e}")
            raise  # Gather'da yakalanması için tekrar fırlat

    async def run_strategy_poller(self, symbol, timeframe='1m'):
        """
        FINAL HYBRID (Local DB + REST Pagination + WebSocket Push) Strateji Motoru:
        1. Yerel DB'den 1500 mum çek (Warm-up) - KURAL 1: db_manager import
        2. Eksik varsa PAGINATION ile doldur - KURAL 2: Sınırsız Yama
        3. RAM koruması (tail 1500) - KURAL 3: RAM Koruması
        4. watch_ohlcv ile WSS üzerinden canlı mumları dinle
        5. Resample + İndikatörler hesapla
        6. 1-to-N botlara broadcast et (asyncio.gather) - KURAL 4: Mevcut Motor Korunur
        """
        from core.paper import paper_engine
        from data.indicators import StrategyIndicators
        from data.features import AdvancedFeatures
        from core.detector import MarketRegimeDetector
        from data.database import db_manager  # KURAL 1: db_manager import
        import ccxt

        logger.info(f"🚀 [FINAL HYBRID] {symbol} için strateji poller başlatılıyor ({timeframe})...")

        # ============================================
        # 1. LOCAL DB FIRST: SQLite'dan geçmiş veriyi çek
        # ============================================
        logger.info(f"📚 [LOCAL DB] {symbol} için yerel veritabanı kontrol ediliyor...")
        ohlcv_df = pd.DataFrame(columns=['open', 'high', 'low', 'close', 'volume'])
        ohlcv_df.index.name = 'timestamp'

        try:
            # Yerel veritabanından son 1500 mumu çek
            db_ohlcv = await db_manager.get_klines(symbol, timeframe='1m', limit=1500)

            if db_ohlcv and len(db_ohlcv) > 0:
                logger.info(f"OK [LOCAL DB] {symbol} için {len(db_ohlcv)} mum bulundu.")

                # DataFrame'e dönüştür
                ohlcv_df = pd.DataFrame(db_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                ohlcv_df['timestamp'] = pd.to_datetime(ohlcv_df['timestamp'], unit='ms')
                ohlcv_df.set_index('timestamp', inplace=True)

                last_db_time = ohlcv_df.index[-1]
                current_time = pd.Timestamp.now(tz='UTC')

                # Timezone düzeltmesi (last_db_time tz-naive olabilir)
                if last_db_time.tzinfo is None:
                    last_db_time = last_db_time.tz_localize('UTC')

                time_diff = current_time - last_db_time

                logger.info(f"OK [LOCAL DB] Son mum: {last_db_time}, Şu an: {current_time}, Fark: {time_diff}")

                # ============================================
                # 2. GAP DETECTION + PAGINATION (Sınırsız Gap Fill) - KURAL 2
                # ============================================
                if time_diff.total_seconds() > 120:  # 2 dakikadan fazla boşluk
                    gap_minutes = time_diff.total_seconds() / 60
                    logger.info(f"🔍 [GAP DETECT] {gap_minutes:.1f} dakika boşluk tespit edildi, REST API ile dolduruluyor...")

                    # PAGINATION: Binance limit (1000 mum) aşılırsa sayfalandır
                    gap_start_ms = int(last_db_time.timestamp() * 1000)
                    total_fetched = 0
                    page = 0
                    limit = 1000  # Binance API limit

                    all_gap_ohlcv = []

                    logger.info(f"📄 [PAGINATION] Gap fill başlatılıyor (limit={limit} mum/sayfa)...")

                    while True:  # Sınırsız döngü - tüm gap dolana kadar
                        page += 1
                        logger.debug(f"📄 [PAGINATION] Sayfa {page} çekiliyor (since={gap_start_ms})...")

                        # Bu sayfanın mumlarını çek
                        page_ohlcv = await self.fetch_ohlcv(symbol, timeframe='1m', since=gap_start_ms, limit=limit)

                        if not page_ohlcv or len(page_ohlcv) == 0:
                            logger.warning(f"WARNING [PAGINATION] Sayfa {page} boş geldi, döngü sonlandırılıyor.")
                            break

                        all_gap_ohlcv.extend(page_ohlcv)
                        total_fetched += len(page_ohlcv)

                        logger.info(f"OK [PAGINATION] Sayfa {page}: {len(page_ohlcv)} mum çekildi (Toplam: {total_fetched})")

                        # Eğer çekilen mum sayısı limit'ten azsa, daha fazla mum yok demektir
                        if len(page_ohlcv) < limit:
                            logger.info(f"OK [PAGINATION] Tüm gap mumları çekildi (Toplam: {total_fetched} mum)")
                            break

                        # Son mumun timestamp'ini al, bir sonraki sayfa için
                        last_fetched_ms = page_ohlcv[-1][0]

                        # Eğer son timestamp güncel zamana yakınsa, döngüyü sonlandır
                        current_ms = int(pd.Timestamp.now(tz='UTC').timestamp() * 1000)
                        if abs(current_ms - last_fetched_ms) < 60000:  # 1 dakika tolerans
                            logger.info(f"OK [PAGINATION] Güncel zamana ulaşıldı (Toplam: {total_fetched} mum)")
                            break

                        # Bir sonraki sayfa için since parametresini güncelle
                        gap_start_ms = last_fetched_ms

                        # Rate limit koruması (Binance: 1200 istek/dakika)
                        await asyncio.sleep(0.1)

                    # TÜM gap mumlarını SQLite'a kaydet
                    if all_gap_ohlcv and len(all_gap_ohlcv) > 0:
                        logger.info(f"💾 [SAVE] {len(all_gap_ohlcv)} gap mumu SQLite'a kaydediliyor...")

                        try:
                            for candle in all_gap_ohlcv:
                                await db_manager.save_kline(symbol, candle, '1m')
                            logger.info(f"OK [SAVE] Tüm gap mumları SQLite'a kaydedildi.")
                        except Exception as save_err:
                            logger.error(f"ERROR [SAVE] SQLite kayıt hatası: {save_err}")

                        # DataFrame'e dönüştür
                        gap_df = pd.DataFrame(all_gap_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                        gap_df['timestamp'] = pd.to_datetime(gap_df['timestamp'], unit='ms')
                        gap_df.set_index('timestamp', inplace=True)

                        # DB verisi ile REST verisini birleştir (concat)
                        ohlcv_df = pd.concat([ohlcv_df, gap_df])

                        # Duplicate kayıtları temizle (index bazlı)
                        ohlcv_df = ohlcv_df[~ohlcv_df.index.duplicated(keep='last')]
                        ohlcv_df = ohlcv_df.sort_index()

                        logger.info(f"OK [STITCH] DB + REST birleştirildi: Toplam {len(ohlcv_df)} mum")
                    else:
                        logger.warning(f"WARNING [REST GAP] Eksik mum çekilemedi, sadece DB verisi kullanılıyor.")
                else:
                    logger.info(f"OK [NO GAP] Veritabanı güncel, REST API çağrısına gerek yok.")
            else:
                logger.warning(f"WARNING [LOCAL DB] {symbol} için veritabanında veri bulunamadı, REST API'den çekiliyor...")

                # Veritabanı boşsa, REST API'den çek
                historical_ohlcv = await self.fetch_ohlcv(symbol, timeframe='1m', limit=1500)

                if historical_ohlcv and len(historical_ohlcv) > 0:
                    ohlcv_df = pd.DataFrame(historical_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                    ohlcv_df['timestamp'] = pd.to_datetime(ohlcv_df['timestamp'], unit='ms')
                    ohlcv_df.set_index('timestamp', inplace=True)
                    logger.info(f"OK [REST] {len(ohlcv_df)} mum REST API'den çekildi.")
                else:
                    logger.warning(f"WARNING [REST] {symbol} için REST API'den veri çekilemedi.")
        except Exception as e:
            import traceback
            logger.error(f"ERROR [HYBRID] {symbol} veri yükleme hatası: {e}")
            logger.error(traceback.format_exc())
            logger.info(f"INFO [HYBRID] Boş DataFrame ile başlanıyor.")

        # ============================================
        # 3. RAM KORUMASI: Sadece son 1500 mum - KURAL 3
        # ============================================
        if len(ohlcv_df) > 1500:
            ohlcv_df = ohlcv_df.tail(1500)
            logger.info(f"OK [RAM] RAM koruması: Son 1500 mum yüklendi.")

        # ============================================
        # 4. WEBSOCKET DÖNGÜSÜ (Canlı Güncelleme)
        # ============================================
        logger.info(f"📡 [WSS] {symbol} için WebSocket döngüsü başlatılıyor...")

        while True:
            try:
                # WebSocket üzerinden OHLCV dinle (PUSH - POLLING YOK!)
                live_ohlcv = await self.exchange.watch_ohlcv(symbol, timeframe='1m', limit=1500)

                if not live_ohlcv or len(live_ohlcv) == 0:
                    logger.warning(f"WARNING [WSS] {symbol} boş OHLCV, devam ediliyor...")
                    await asyncio.sleep(5)
                    continue

                # Canlı veriyi DataFrame'e dönüştür
                # live_ohlcv is a list of lists: [[timestamp, open, high, low, close, volume], ...]
                live_df = pd.DataFrame(live_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                live_df['timestamp'] = pd.to_datetime(live_df['timestamp'], unit='ms')
                live_df.set_index('timestamp', inplace=True)

                # ============================================
                # 5. CANLI VERİ BİRLEŞTİRME + RAM KORUMASI
                # ============================================
                if ohlcv_df.empty:
                    # İlk veri, direkt kullan
                    ohlcv_df = live_df.copy()
                    logger.info(f"OK [WSS] İlk veri: {len(ohlcv_df)} mum")
                else:
                    # Canlı veriyi geçmiş veriye ekle/güncelle
                    last_live_time = live_df.index[-1]
                    last_hist_time = ohlcv_df.index[-1]

                    if last_live_time > last_hist_time:
                        # Yeni mum geldi, ekle
                        ohlcv_df = pd.concat([ohlcv_df, live_df.loc[last_hist_time:]])
                        logger.debug(f"OK [WSS] Yeni mum eklendi: {last_live_time}")
                    elif last_live_time == last_hist_time:
                        # Son mum güncellendi, replace et
                        ohlcv_df.loc[last_live_time] = live_df.loc[last_live_time]
                        logger.debug(f"OK [WSS] Son mum güncellendi: {last_live_time}")

                    # RAM koruması: Sadece son 1500 mum
                    if len(ohlcv_df) > 1500:
                        ohlcv_df = ohlcv_df.tail(1500)

                last_candle_time = ohlcv_df.index[-1]
                df_1m = ohlcv_df

                # 4. HEDEF VADEYE DÖNÜŞTÜR (Resampling Engine)
                target_tf = paper_engine.active_timeframes.get(symbol, '1m')
                df_target = StrategyIndicators.resample_data(df_1m, target_tf)

                # 5. ÜST ZAMAN DİLİMİ (HTF) TEYİDİ
                def get_higher_tf(tf_str):
                    tf_map = {'1m': '15m', '3m': '15m', '5m': '30m', '15m': '1h', '30m': '4h', '1h': '4h', '4h': '1d'}
                    return tf_map.get(tf_str, '4h')

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

                    # 7. MARKET REGİME (PİYASA REJİMİ) TESPİTİ
                    regime_info = MarketRegimeDetector.detect_regime(df_target)
                    paper_engine.market_regime = regime_info['regime']

                    # 7.5 STRATEJİ KONTROLÜ - Eğer strateji yoksa işlem yapma
                    strategy = paper_engine.strategies.get(symbol)
                    active_strat_id = paper_engine.active_strategies.get(symbol, 'NOT_SET')

                    # YENİ 1-to-N: active_bots kontrolü (eski active_strategies yerine)
                    active_bot_ids = [
                        bot_id for bot_id, bot_info in paper_engine.active_bots.items()
                        if bot_info['symbol'] == symbol and bot_info['status'] == 'running'
                    ]

                    if (strategy is None or active_strat_id == "") and not active_bot_ids:
                        # Strateji durdurulmuş VE aktif bot yok, sadece fiyat güncellemesi yap
                        await paper_engine.update_live_prices(symbol, current_price)
                        logger.debug(f"⏸️ {symbol} için strateji durduruldu ve aktif bot yok, sadece fiyat güncelleniyor.")
                        continue

                    logger.debug(f"▶️ {symbol} strateji aktif: {active_strat_id}, strategy={strategy}, aktif bot sayısı: {len(active_bot_ids)}")

                    # ============================================
                    # YENİ 1-to-N MİMARİSİ: Merkezi Poller, Dağıtık İşleme
                    # ============================================
                    # Bu sembol için aktif tüm botları bul
                    active_bot_ids = [
                        bot_id for bot_id, bot_info in paper_engine.active_bots.items()
                        if bot_info['symbol'] == symbol and bot_info['status'] == 'running'
                    ]

                    if active_bot_ids:
                        logger.info(f"🤖 [1-to-N] {symbol} için {len(active_bot_ids)} aktif bot işleniyor...")

                        # PARALEL İŞLEME: Her bot için asenkron task oluştur
                        # Kritik: 1h botunun ML hesaplaması 1m botunu bekletmez!
                        bot_tasks = []
                        for bot_id in active_bot_ids:
                            # Her bot task'ı ayrı oluştur (non-blocking)
                            task = asyncio.create_task(
                                self._process_bot_task(paper_engine, bot_id, df_target, current_price, htf_trend, regime_info['regime'])
                            )
                            bot_tasks.append(task)

                        # Tüm botları PARALEL çalıştır (gather)
                        # Hata yönetimi: Bir bot çökerse diğerleri etkilenmez
                        if bot_tasks:
                            try:
                                results = await asyncio.gather(*bot_tasks, return_exceptions=True)

                                # Sonuçları logla
                                for bot_id, result in zip(active_bot_ids, results):
                                    if isinstance(result, Exception):
                                        logger.error(f"❌ [BOT] {bot_id} işleme hatası: {result}")
                                    else:
                                        logger.debug(f"✅ [BOT] {bot_id} başarıyla işlendi")
                            except Exception as gather_err:
                                logger.error(f"❌ [1-to-N] Gather hatası: {gather_err}")
                    else:
                        logger.debug(f"⚠️ [1-to-N] {symbol} için aktif bot yok")

                    # ESKİ MİMARİ KALDIRILDI! Sadece 1-to-N kullanılıyor

                    # 8. YAPAY ZEKA TAHMİNİ (Hedef Vade Verileriyle)
                    logger.info(f"✅ {symbol} {target_tf} (HTF: {htf_trend} | REJİM: {regime_info['regime']}) analiz tamamlandı. Botlar işlendi.")

            # BAĞLANTI KOPMA VE RECONNECT KALKANI
            except ccxt.NetworkError as e:
                logger.error(f"❌ [WSS] {symbol} NetworkError: {e}. 5 saniye sonra yeniden bağlanıyor...")
                await asyncio.sleep(5)
                continue
            except ccxt.ExchangeError as e:
                logger.error(f"❌ [WSS] {symbol} ExchangeError: {e}. 5 saniye sonra yeniden bağlanıyor...")
                await asyncio.sleep(5)
                continue
            except asyncio.CancelledError:
                logger.info(f"🛑 [WSS] {symbol} WebSocket döngüsü iptal edildi.")
                break
            except Exception as e:
                import traceback
                logger.error(f"❌ [WSS] {symbol} Strateji Döngü Hatası: {e}")
                logger.error(traceback.format_exc())
                await asyncio.sleep(5)
                continue

    async def close(self):
        """Borsa bağlantılarını ve WebSocket akışlarını temiz bir şekilde kapatır."""
        if self.exchange:
            await self.exchange.close()
            logger.info(f"{self.exchange_id.upper()} borsa bağlantısı sonlandırıldı.")


# Diğer modüllerden kolay erişim için Singleton mantığı
exchange_manager = ExchangeManager()
