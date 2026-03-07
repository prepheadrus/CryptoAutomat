import pandas as pd
from core.config import CONFIG
from core.logger import logger
from strategy.confluence import StrategyConfluence
from strategy.risk import RiskManagement

# ML Model Integration
try:
    from ml.model_training import ModelTrainer
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logger.warning("⚠️ ML modeli bulunamadı, sadece strateji sinyalleri kullanılacak.")


# ============================================
# RENKLİ LOG FORMATTER (Canlı Test için)
# ============================================
def log_ai_decision(symbol: str, strategy_name: str, strategy_signal: int,
                   ml_recommendation: str, ml_confidence_pct: float,
                   action: str, leverage: float = 1.0):
    """
    Yapay zeka kararını renkli ve dikkat çekici şekilde loglar.

    Args:
        symbol: Sembol adı (BTC/USDT)
        strategy_name: Strateji adı
        strategy_signal: Strateji sinyali (0=SAT, 1=HOLD, 2=AL)
        ml_recommendation: ML önerisi
        ml_confidence_pct: ML güven yüzdesi
        action: Aksiyon (OPEN, REJECT, FILTER)
        leverage: Kaldıraç
    """
    signal_emoji = "🟢" if strategy_signal == 2 else "🔴" if strategy_signal == 0 else "🟡"
    signal_text = "AL" if strategy_signal == 2 else "SAT" if strategy_signal == 0 else "HOLD"

    if action == "OPEN":
        logger.info(
            f"\n{'='*60}\n"
            f"🤖 [AI KARARI] İŞLEM AÇILIYOR!\n"
            f"{'='*60}\n"
            f"  📊 Sembol: {symbol}\n"
            f"  🧠 Strateji: {strategy_name} -> {signal_emoji} {signal_text}\n"
            f"  🤖 ML Önerisi: {ml_recommendation} ({ml_confidence_pct:.1f}% Güven)\n"
            f"  💰 Kaldıraç: {leverage}x\n"
            f"  ✅ AKSİYON: İşleme giriliyor...\n"
            f"{'='*60}"
        )
    elif action == "REJECT_CONFLUENCE":
        logger.warning(
            f"\n{'='*60}\n"
            f"⚠️ [AI FİLTRESİ] İŞLEM REDDEDİLDİ (Çakışma!)\n"
            f"{'='*60}\n"
            f"  📊 Sembol: {symbol}\n"
            f"  🧠 Strateji: {strategy_name} -> {signal_text}\n"
            f"  🤖 ML Önerisi: {ml_recommendation} ({ml_confidence_pct:.1f}% Güven)\n"
            f"  ❌ AKSİYON: Strateji ve ML çakışıyor!\n"
            f"{'='*60}"
        )
    elif action == "REJECT_LOW_CONFIDENCE":
        logger.warning(
            f"\n{'='*60}\n"
            f"⚠️ [AI FİLTRESİ] İŞLEM REDDEDİLDİ (Düşük Güven)\n"
            f"{'='*60}\n"
            f"  📊 Sembol: {symbol}\n"
            f"  🧠 Strateji: {strategy_name} -> {signal_text}\n"
            f"  🤖 ML Önerisi: {ml_recommendation} ({ml_confidence_pct:.1f}% Güven)\n"
            f"  ❌ AKSİYON: Güven skoru yetersiz (<65%)\n"
            f"{'='*60}"
        )

class PaperTrader:
    """
    Sanal (Kağıt Üzerinde) kripto para al-sat borsa mekanizması.
    Gerçek parayı riske atmadan; slipaj, komisyon ve bakiye takibini gerçekçi bir şekilde simüle eder.

    Binance Gerçek Komisyon Oranları (2026):
    - Spot: Maker %0.1, Taker %0.1
    - Futures: Maker %0.02, Taker %0.04
    """
    def __init__(self, initial_balance=10000.0, fee_rate_spot=0.001, fee_rate_futures=0.0004):
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.free_margin = initial_balance # Boştaki Kasa Parası
        self.used_margin = 0.0 # İşlemdeki Kasa Parası

        # Komisyon oranları (Binance gerçek oranları)
        self.fee_rate_spot = fee_rate_spot      # %0.1 (Spot)
        self.fee_rate_futures = fee_rate_futures # %0.04 (Futures)
        self.fee_rate = fee_rate_futures  # Varsayılan: Futures
        
        # Açık pozisyonları bir list of dict olarak tut
        self.open_positions = []
        
        # Geçmiş İşlemler
        self.trade_history = []
        
        # ML Engine Skoru (Arayüz için önbellek)
        self.global_confidence = 0.0
        self.volatility_shield = "SAFE"

        # Acil Durdurma (Kill Switch)
        self.kill_switch_activated = False
        self.consecutive_losses = 0
        self.max_consecutive_losses = CONFIG['risk_management'].get('max_consecutive_losses', 5)
        
        # İstatistikler
        self.total_trades = 0
        self.total_wins = 0
        self.total_pnl = 0.0
        self.total_commission = 0.0
        self.market_regime = "UNKNOWN"

        # ML Model Yükleme (Eğitilmiş model varsa)
        self.ml_model = None
        self.ml_enabled = False

        if ML_AVAILABLE:
            try:
                model_path = CONFIG.get('ml', {}).get('model_path', 'artifacts/models/xgb_model.json')
                logger.info(f"🤖 ML modeli yükleniyor: {model_path}...")
                self.ml_model = ModelTrainer()
                self.ml_model.load_model(model_path)
                self.ml_enabled = True
                logger.info(f"✅ ML modeli BAŞARIYLA yüklendi! (enabled={self.ml_enabled})")
            except Exception as e:
                logger.error(f"❌ ML modeli yüklenemedi: {str(e)}")
                logger.warning("⚠️ ML olmadan devam ediliyor (sadece strateji sinyalleri).")
                import traceback
                logger.error(traceback.format_exc())
                self.ml_enabled = False
        else:
            logger.warning("⚠️ ML kütüphanesi bulunamadı (ml/model_training.py import edilemedi).")
        # Dinamik Strateji (Bot) Yönetimi - ARTIK SEMBOL BAZLI
        from strategy.manager import StrategyManager
        self.active_strategies = {} # symbol -> strategy_id
        self.strategies = {}        # symbol -> strategy_instance
        self.active_timeframes = {} # symbol -> timeframe (1m, 5m, 15m vb.)
        self.market_types = {}      # symbol -> 'spot' | 'swap' | 'future'
        self.margin_types = {}      # symbol -> 'isolated' | 'cross'
        
        # Tüm pariteleri varsayılan 'trend_master' ve '1m' ile başlat
        for symbol in CONFIG['trading']['symbols']:
            self.active_strategies[symbol] = "trend_master"
            self.strategies[symbol] = StrategyManager.get_strategy("trend_master")
            self.active_timeframes[symbol] = "1m"
        
        # Arayüze botun ne düşündüğünü yansıtmak için son kararları parite bazlı sakla
        self.latest_decisions = {} 

    @property
    def timeframe(self):
        """Eski kodlarla uyumluluk için varsayılan zaman dilimini döner."""
        return next(iter(self.active_timeframes.values())) if self.active_timeframes else "1m"

    def set_strategy(self, strategy_id: str, symbol: str = None, timeframe: str = "1m"):
        """Botun stratejisini ve zaman dilimini çalışma anında dinamik olarak değiştirir."""
        from strategy.manager import StrategyManager
        new_strategy = StrategyManager.get_strategy(strategy_id)
        
        if symbol:
            # Sadece tek pariteyi değiştir
            self.active_strategies[symbol] = strategy_id
            self.strategies[symbol] = new_strategy
            self.active_timeframes[symbol] = timeframe
            logger.info(f"🤖 {symbol} için strateji '{new_strategy.name()}' ve zaman dilimi '{timeframe}' olarak güncellendi.")
            
            # Yalnızca bu coinin karar geçmişini sil (Arayüzde taze veri beklesin)
            if symbol in self.latest_decisions:
                del self.latest_decisions[symbol]
        else:
            # Global olarak hepsini birden değiştir (Toplu komut)
            for s in self.active_strategies.keys():
                self.active_strategies[s] = strategy_id
                self.strategies[s] = new_strategy
                self.active_timeframes[s] = timeframe
            logger.info(f"🚀 TÜM sisteme '{new_strategy.name()}' stratejisi ve '{timeframe}' periyodu atandı.")
            
            # Toplu komutta tüm karar geçmişini temizle
            self.latest_decisions = {}

    def set_market_type(self, symbol: str, market_type: str):
        """Sembolün market tipini (spot, swap, future) belirler."""
        self.market_types[symbol] = market_type.lower()

    def set_margin_type(self, symbol: str, margin_type: str):
        """Marjin tipini (isolated, cross) belirler."""
        self.margin_types[symbol] = margin_type.lower()

    async def process_signal(self, symbol: str, current_price: float, df: pd.DataFrame, ml_confidence: float, htf_trend: str = "NEUTRAL", regime: str = "UNKNOWN"):
        """Her yeni mum kapandığında botun indikatör ve sinyallerini tarayıp, pozisyon al-kapat kararı verir."""
        if df.empty or len(df) < 50:
            return

        latest_candle = df.iloc[-1]

        # Sembole atanmış özel stratejiyi (botu) getir
        strategy = self.strategies.get(symbol, self.strategies[list(self.strategies.keys())[0]])

        # 1. Volatilite denetimi
        is_safe = StrategyConfluence.is_volatility_safe(latest_candle)
        self.volatility_shield = "SAFE" if is_safe else "DANGER"
        self.global_confidence = ml_confidence

        # 3. Aktif Stratejiden (Bot'tan) Sinyali Al
        strategy_signal = strategy.generate_signal(latest_candle)

        # ============================================
        # ML CONFLUENCE (YAPAY ZEKA ONAY MEKANİZMASI)
        # ============================================
        ml_signal = 1  # Varsayılan: HOLD
        ml_confidence_pct = 0.0
        ml_recommendation = "HOLD"

        if self.ml_enabled and self.ml_model is not None:
            try:
                # ML modelinden tahmin al
                latest_row = latest_candle.to_frame().T

                # Feature names kontrolü
                if self.ml_model.feature_names is None:
                    logger.warning(f"[ML] {symbol}: Model feature_names None! Model düzgün yüklenmemiş olabilir.")
                    ml_signal = 1
                    ml_confidence_pct = 0.0
                    ml_recommendation = "HOLD"
                else:
                    # Sadece modelin beklediği feature'ları al
                    missing_cols = [col for col in self.ml_model.feature_names if col not in latest_row.columns]
                    if missing_cols:
                        logger.debug(f"[ML] {symbol}: Eksik kolonlar: {missing_cols[:5]}... (toplam {len(missing_cols)})")
                        # Eksik kolonları 0 ile doldur
                        for col in missing_cols:
                            latest_row[col] = 0

                    # Sadece feature_names'deki kolonları kullan
                    X_input = latest_row[self.ml_model.feature_names]

                    ml_result = self.ml_model.predict_single(X_input)
                    ml_signal = ml_result['prediction']
                    ml_confidence_pct = ml_result['confidence_pct']
                    ml_recommendation = ml_result['recommendation']

                # ML Confidence'ı güncelle
                ml_confidence = ml_confidence_pct / 100.0

                logger.debug(f"[ML] {symbol}: {ml_recommendation} (Güven: {ml_confidence_pct:.1f}%)")

            except Exception as e:
                logger.warning(f"[ML] {symbol} tahmin hatası: {str(e)}")
                logger.debug(f"[ML] Hata detayı: {type(e).__name__}")
                ml_signal = 1
                ml_confidence_pct = 0.0
                ml_recommendation = "HOLD"
        else:
            # ML kapalıysa, strateji sinyalini kullan
            ml_confidence = ml_confidence if ml_confidence > 0 else 0.50

        # Arayüz için Karar Günlüğünü Parite Bazlı Kaydet
        self.latest_decisions[symbol] = {
            "symbol": symbol,
            "bot_name": strategy.name(),
            "price": current_price,
            "rsi": round(latest_candle.get('RSI_14', 0), 2),
            "ema_5": round(latest_candle.get('EMA_5', 0), 2),
            "ema_13": round(latest_candle.get('EMA_13', 0), 2),
            "sma_20": round(latest_candle.get('SMA_20', 0), 2),
            "ema_50": round(latest_candle.get('EMA_50', 0), 2),
            "vwap": round(latest_candle.get('VWAP', 0), 2),
            "atr": round(latest_candle.get('ATR_14', 0), 2),
            "kalman": round(latest_candle.get('KALMAN', 0), 2),
            "azul": round(latest_candle.get('KONKORDE_AZUL', 0), 1),
            "verde": round(latest_candle.get('KONKORDE_VERDE', 0), 1),
            "vix": round(latest_candle.get('BTC_VIX', 0), 1),
            "signal_val": strategy_signal,
            "ml_signal": ml_signal,
            "ml_recommendation": ml_recommendation,
            "ml_confidence": round(ml_confidence_pct, 1),
            "is_safe": is_safe,
            "timeframe": self.active_timeframes.get(symbol, "1m")
        }

        if not is_safe:
            logger.debug(f"[FILTER] {symbol} Volatilite kalkanı aktif (Riskli piyasa).")
            return

        # ============================================
        # CONFLUENCE MEKANİZMASI (Strateji + ML Onayı)
        # ============================================
        # ML Model Sınıfları: 0=SHORT, 1=LONG, 2=NEUTRAL
        # Strateji Sinyalleri: 0=SAT, 1=HOLD, 2=AL

        final_signal = 1  # Varsayılan: HOLD

        if strategy_signal == 2:  # Strateji LONG diyor (AL)
            if ml_signal == 1 or ml_recommendation in ["LONG", "STRONG_LONG"]:
                # ML de LONG diyor → ONAYLANDI
                final_signal = 2
                logger.debug(f"[CONFLUENCE] {symbol} LONG onaylandı: Strateji=AL, ML={ml_recommendation} ({ml_confidence_pct:.1f}%)")
            elif ml_signal == 0 or ml_recommendation in ["SHORT", "STRONG_SHORT"]:
                # ML SHORT diyor → ÇAKIŞMA, iptal
                log_ai_decision(symbol, strategy.name(), strategy_signal, ml_recommendation, ml_confidence_pct, "REJECT_CONFLUENCE")
                return
            elif ml_confidence_pct < 65:
                # ML güveni düşük → İptal
                log_ai_decision(symbol, strategy.name(), strategy_signal, ml_recommendation, ml_confidence_pct, "REJECT_LOW_CONFIDENCE")
                return

        elif strategy_signal == 0:  # Strateji SHORT diyor (SAT)
            if ml_signal == 0 or ml_recommendation in ["SHORT", "STRONG_SHORT"]:
                # ML de SHORT diyor → ONAYLANDI
                final_signal = 0
                logger.debug(f"[CONFLUENCE] {symbol} SHORT onaylandı: Strateji=SAT, ML={ml_recommendation} ({ml_confidence_pct:.1f}%)")
            elif ml_signal == 2 or ml_recommendation in ["LONG", "STRONG_LONG"]:
                # ML LONG diyor → ÇAKIŞMA, iptal
                log_ai_decision(symbol, strategy.name(), strategy_signal, ml_recommendation, ml_confidence_pct, "REJECT_CONFLUENCE")
                return
            elif ml_confidence_pct < 65:
                # ML güveni düşük → İptal
                logger.debug(f"[CONFLUENCE] {symbol} SHORT sinyali REDDEDİLDİ: ML güveni düşük ({ml_confidence_pct:.1f}%)")
                return

        # Sinyal bilgisini her seferinde debug olarak bas (Neden hold olduğunu görelim)
        if final_signal == 1:
            logger.debug(f"[FILTER] {symbol} Sinyal: HOLD (Confluence sağlanmadı)")
            return

        # Market rejimini her seferinde Dashboard için hafızaya al
        self.market_regime = regime

        # 2. Daha önce sistemde bu paritede açık bir pozisyonum var mı?
        if any(pos['symbol'] == symbol for pos in self.open_positions):
            return

        # 3. ML Eşik Değerini Config'den Al
        threshold = float(CONFIG['strategy'].get('ml_confidence_threshold', 0.60))

        # Market rejimini her seferinde Dashboard için hafızaya al
        self.market_regime = regime

        # ML skorumuzu da dahil edelim
        if final_signal != 1 and ml_confidence >= threshold:
            # --- MARKET REGIME (PİYASA REJİMİ) FİLTRESİ ---
            # Eğer strateji trend takipçisiyse (Trend Master) ve market YATAY (RANGING) ise girme
            if "TrendMaster" in strategy.name() and regime == "RANGING":
                logger.warning(f"⚠️ [REGIME FILTER] {symbol} TREND sinyali var ama piyasa YATAY (RANGING). İşlem Engellendi.")
                return

            # --- MULTI-TIMEFRAME (HTF) TREND TEYİDİ ---
            if final_signal == 2:
                # LONG açmak için HTF Ayı (BEAR) olmamalı
                if htf_trend == "BEAR":
                    logger.warning(f"⚠️ [HTF FILTER] {symbol} 15m LONG sinyali var ama 1h-4h Trend AYI (BEAR). İşlem Engellendi.")
                    return

                logger.info(f"🚀 [LONG] {symbol} Sinyali Yakalandı! ML: {ml_recommendation} ({ml_confidence_pct:.1f}%) (HTF: {htf_trend})")
                await self._open_new_position(symbol, "LONG", current_price, latest_candle, ml_confidence_pct, ml_recommendation)

            elif final_signal == 0:
                # --- SPOT MARKET ÖZEL MANTIĞI ---
                # Spot piyasada SHORT (açığa satış) yapılamaz.
                # Bunun yerine, eğer açık bir LONG varsa onu kapatırız (Satış).
                is_spot = self.market_types.get(symbol, 'swap') == 'spot'

                if is_spot:
                    # Açık LONG pozisyonu bul
                    for i, pos in enumerate(self.open_positions):
                        if pos['symbol'] == symbol and pos['direction'] == "LONG":
                            logger.info(f"📉 [SPOT SELL] {symbol} için SHORT sinyali geldi. Mevcut LONG pozisyonu KAPATILIYOR (Satış).")
                            await self._close_position(i, pos, current_price, "Spot Sinyal (Dönüş)")
                            return

                    logger.debug(f"[SPOT] {symbol} için SHORT sinyali geldi ama açık LONG yok. İşlem pas geçildi.")
                    return

                # Normal VADELİ (Future/Swap) mantığı devam eder
                # SHORT açmak için HTF Boğa (BULL) olmamalı
                if htf_trend == "BULL":
                    logger.warning(f"⚠️ [HTF FILTER] {symbol} 15m SHORT sinyali var ama 1h-4h Trend BOĞA (BULL). İşlem Engellendi.")
                    return

                logger.info(f"🚀 [SHORT] {symbol} Sinyali Yakalandı! ML: {ml_recommendation} ({ml_confidence_pct:.1f}%) (HTF: {htf_trend})")
                await self._open_new_position(symbol, "SHORT", current_price, latest_candle, ml_confidence_pct, ml_recommendation)
        else:
            # İşlem açılmamasının ana sebebi genellikle budur
            if final_signal != 1:
                logger.debug(f"[FILTER] {symbol} ML Güven Skoru Yetersiz: {ml_confidence:.2f} (Eşik: {threshold})")

    async def _open_new_position(
        self,
        symbol,
        direction,
        price,
        latest_candle,
        ml_confidence_pct: float = 0.0,
        ml_recommendation: str = "HOLD"
    ):
        """
        Gerçekçi bir biçimde komisyonu (fee) ve kaymayı (slippage) hesaplayarak işleme girer.

        DİNAMİK KALDIRAÇ SİSTEMİ:
        - STRONG_LONG / STRONG_SHORT (≥80%): 5x-10x kaldıraç
        - LONG / SHORT (65-79%): 2x-3x kaldıraç
        - WEAK (<65%): 1x (minimum risk)
        """
        # --- KILL SWITCH KONTROLÜ ---
        if self.kill_switch_activated:
            logger.critical(f"🚨 KILL SWITCH AKTİF! Yeni işlem açma engellendi: {symbol}")
            return

        # Risk hesaplama parametreleri (Config'den oku)
        risk_percent = CONFIG['risk_management'].get('max_risk_per_trade_percent', 0.2)

        atr = latest_candle.get('ATR_14', price * 0.01) # Eğer ATR yoksa %1 varsay

        # --- DİNAMİK RİSK HESAPLAMA (Seçili Botun Parametrelerine Göre) ---
        strategy = self.strategies.get(symbol)
        stop_params = strategy.get_stop_params()
        multiplier = stop_params.get("atr_multiplier", 3.0)

        stop_loss, take_profit = RiskManagement.calculate_dynamic_stops(
            price, direction, atr, multiplier=multiplier
        )

        # --- SPOT MARKET KALDIRAÇ KONTROLÜ ---
        is_spot = self.market_types.get(symbol, 'swap') == 'spot'

        if is_spot:
            leverage = 1.0  # Spotta kaldıraç 1x'dir.
        else:
            # ============================================
            # DİNAMİK KALDIRAÇ HESAPLAMA (ML Güven Skoru Bazlı)
            # ============================================
            max_lev = CONFIG['risk_management'].get('max_leverage', 10)

            # ML önerisine göre kaldıraç belirle
            if ml_recommendation in ["STRONG_LONG", "STRONG_SHORT"]:
                # Yüksek güven (%80+): Maksimum kaldıraç
                leverage = min(max_lev, 10)  # 5x-10x arası
            elif ml_recommendation in ["LONG", "SHORT"]:
                # Orta güven (%65-79%): Orta kaldıraç
                leverage = min(max_lev, 3)  # 2x-3x arası
            else:
                # Düşük güven (<65%): Minimum kaldıraç
                leverage = 1.0

        pos_size_crypto = RiskManagement.calculate_position_size(
            account_balance=self.balance,
            risk_percentage=risk_percent,
            entry_price=price,
            stop_loss_price=stop_loss
        )

        # Parasal Büyüklük = (Kripto Adedi * Fiyat)
        position_value_usd = pos_size_crypto * price
        required_margin = position_value_usd / leverage

        # Bakiye yetersizse girme
        if required_margin > self.free_margin:
            logger.warning(f"Limit yetersiz! ({symbol}) Marjin İhtiyacı: ${required_margin:.2f}")
            return

        # ============================================
        # RENKLİ AI KARARI LOGU (İşlem açılıyor)
        # ============================================
        strategy = self.strategies.get(symbol)
        log_ai_decision(
            symbol=symbol,
            strategy_name=strategy.name() if strategy else "Unknown",
            strategy_signal=2 if direction == "LONG" else 0,
            ml_recommendation=ml_recommendation,
            ml_confidence_pct=ml_confidence_pct,
            action="OPEN",
            leverage=leverage
        )

        # Slipaj Simülasyonu
        execution_price = price * 1.0001 if direction == "LONG" else price * 0.9999

        # Giriş Komisyonu (Spot vs Futures)
        is_spot = self.market_types.get(symbol, 'swap') == 'spot'
        fee_rate = self.fee_rate_spot if is_spot else self.fee_rate_futures
        fee = position_value_usd * fee_rate

        self.free_margin -= (required_margin + fee)
        self.used_margin += required_margin
        
        # --- LİKİDASYON FİYATI HESABI (Isolated vs Cross) ---
        margin_type = self.margin_types.get(symbol, 'isolated')
        
        if margin_type == 'isolated':
            # Sadece pozisyona ayrılan marjin yanar (Basit İzole Mantığı %90 Kayıpta Likit)
            liq_price = execution_price * (1 - 0.9 / leverage) if direction == "LONG" else execution_price * (1 + 0.9 / leverage)
        else:
            # Çapraz Marjin: Tüm 'Free Margin' likidasyonu korumak için kullanılır
            # Basitçe: Tüm para / Pozisyon Büyüklüğü kadar ters hareket olursa likit olur
            total_risk_buffer = (self.free_margin + required_margin) / position_value_usd
            liq_price = execution_price * (1 - total_risk_buffer * 0.9) if direction == "LONG" else execution_price * (1 + total_risk_buffer * 0.9)
            # Liq fiyatı sıfırın altına inemez
            if liq_price < 0: liq_price = 0

        new_position = {
            'symbol': symbol,
            'direction': direction,
            'entry_price': execution_price,
            'current_price': execution_price,
            'size': pos_size_crypto,
            'notional_value': position_value_usd, # Toplam Pozisyon Değeri
            'leverage': leverage,
            'margin': required_margin,
            'margin_type': margin_type,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'liquidation_price': liq_price,
            'pnl_percent': 0.0,
            'unrealized_usd': -fee, # Komisyon anında zarara yansır

            # ADIM 1: Dinamik İzleyen Stop (Trailing Stop) için gerekli state değişkenleri
            'atr': atr,                    # İşleme girildiği anki ATR değeri
            'atr_multiplier': multiplier,  # Piyasa gürültüsünden korunmak için çarpan (Örn: 2.0)
            'highest_seen': execution_price, # LONG için: Fiyatın ulaştığı en yüksek nokta
            'lowest_seen': execution_price,  # SHORT için: Fiyatın ulaştığı en düşük nokta

            # Raporlama için ek meta veriler
            'strategy': strategy.name(),
            'timeframe': self.active_timeframes.get(symbol, '1m'),
            
            # Çift Kapanış (Double Close) sorununu önlemek için kilit
            'is_closing': False
        }
        
        self.total_commission += fee
        
        self.open_positions.append(new_position)
        logger.info(f"[PAPER TRADE] {direction} İşlemi Açıldı: {symbol} | Giriş: {execution_price:.2f} | Kaldıraç: {leverage}x")

    async def update_live_prices(self, symbol: str, current_price: float):
        """
        WebSocket ile Borsa Ticker'ından gelen her yeni fiyatta
        açık pozisyonların anlık PnL'sini hesaplar.

        ADIM 3 ENTEGRASYONU:
        - update_trailing_stop() ile trailing stop güncellenir
        - check_exit_condition() ile stop patlama kontrolü yapılır (current_high/low kullanılır)
        """
        for i, pos in enumerate(self.open_positions):
            if pos['symbol'] == symbol:
                pos['current_price'] = current_price

                # --- ADIM 2: İz Süren Stop (Trailing) Güncelleme Fonksiyonu ---
                # Yeni bir metod olarak ayrılmıştır: update_trailing_stop
                await self.update_trailing_stop(pos, current_price, current_price)

                # --- ADIM 3: Çıkış Koşulu Kontrolü (Stop Patlama) ---
                # Şu anlık current_price kullanıyoruz, gelecek adımda mum high/low kullanılacak
                await self.check_exit_condition(pos, current_price, current_price)

                # Karşılaştırma / Yüzdelik PnL ve USD PnL
                if pos['direction'] == "LONG":
                    price_diff_percent = ((current_price - pos['entry_price']) / pos['entry_price']) * 100
                    pnl_usd = (current_price - pos['entry_price']) * pos['size']
                else: # SHORT
                    price_diff_percent = ((pos['entry_price'] - current_price) / pos['entry_price']) * 100
                    pnl_usd = (pos['entry_price'] - current_price) * pos['size']

                # Kaldıraçlı ROE (Return on Equity - Ana Paranın Yüzdesi)
                pos['pnl_percent'] = price_diff_percent * pos['leverage']
                pos['unrealized_usd'] = pnl_usd

                # Stop Loss veya Take Profit Kesişimi var mı?
                await self._check_closure(i, pos, current_price)

                # Likidasyon Kontrolü
                if (pos['direction'] == "LONG" and current_price <= pos['liquidation_price']) or \
                   (pos['direction'] == "SHORT" and current_price >= pos['liquidation_price']):
                    await self._close_position(i, pos, current_price, "LİKİDASYON (Marjin Sıfırlandı)")

    async def update_trailing_stop(self, pos: dict, current_high: float, current_low: float):
        """
        ADIM 2: İz Süren Stop (Trailing Stop) güncelleme fonksiyonu.

        Args:
            pos: Pozisyon dictionary (open_positions içindeki kayıt)
            current_high: O anki mumun en yüksek fiyatı (high)
            current_low: O anki mumun en düşük fiyatı (low)

        LONG İşlemler:
            - current_high > highest_seen ise yeni zirve gelmiş demektir
            - Zirveden (ATR × Çarpan) çıkararak potansiyel yeni stop hesapla
            - Eğer yeni stop > eski stop ise stobu güncelle (SADECE YUKARI)

        SHORT İşlemler:
            - current_low < lowest_seen ise yeni dip gelmiş demektir
            - Dipten (ATR × Çarpan) ekleyerek potansiyel yeni stop hesapla
            - Eğer yeni stop < eski stop ise stobu güncelle (SADECE AŞAĞI)
        """
        if pos['direction'] == "LONG":
            # LONG için: Yeni zirve kontrolü
            if current_high > pos['highest_seen']:
                # Yeni zirve geldi, highest_seen güncelle
                pos['highest_seen'] = current_high

                # Potansiyel yeni stop = Zirve - (ATR × Çarpan)
                new_stop = current_high - (pos['atr'] * pos['atr_multiplier'])

                # Stop'u SADECE YUKARI taşıyabiliriz
                if new_stop > pos['stop_loss']:
                    pos['stop_loss'] = new_stop
                    logger.debug(f"[TRAILING STOP] {pos['symbol']} LONG stop yukarı taşındı: {pos['stop_loss']:.2f}")

        else:  # SHORT
            # SHORT için: Yeni dip kontrolü
            if current_low < pos['lowest_seen']:
                # Yeni dip geldi, lowest_seen güncelle
                pos['lowest_seen'] = current_low

                # Potansiyel yeni stop = Dip + (ATR × Çarpan)
                new_stop = current_low + (pos['atr'] * pos['atr_multiplier'])

                # Stop'u SADECE AŞAĞI taşıyabiliriz
                if new_stop < pos['stop_loss']:
                    pos['stop_loss'] = new_stop
                    logger.debug(f"[TRAILING STOP] {pos['symbol']} SHORT stop aşağı taşındı: {pos['stop_loss']:.2f}")

    async def check_exit_condition(self, pos: dict, current_high: float, current_low: float):
        """
        ADIM 3: Çıkış Koşulu Kontrolü ve Gerçekçi Simülasyon.

        Stop patlama kontrolü + Slipaj + Komisyon hesaplama.

        Args:
            pos: Pozisyon dictionary (open_positions içindeki kayıt)
            current_high: O anki mumun en yüksek fiyatı (high)
            current_low: O anki mumun en düşük fiyatı (low)

        LONG İşlemler:
            - Eğer current_low <= pos['stop_loss'] ise STOP PATLADI (çıkış tetiklenir)

        SHORT İşlemler:
            - Eğer current_high >= pos['stop_loss'] ise STOP PATLADI (çıkış tetiklenir)

        Gerçekçi Simülasyon:
            - Çıkış fiyatı olarak stop_loss seviyesi baz alınır
            - Slipaj (1.0001) uygulanır:
              * LONG çıkış (satış): exit_price / 1.0001 (biraz daha aşağıdan sat)
              * SHORT çıkış (alış): exit_price * 1.0001 (biraz daha yukarıdan al)
            - Komisyon (fee_rate) uygulanır
            - Net PnL hesaplanır
        """
        should_close = False
        reason = ""
        exit_price = 0.0

        # --- STOP PATLAMA KONTROLÜ ---
        if pos['direction'] == "LONG":
            # LONG için: current_low <= stop_loss ise stop patladı
            if current_low <= pos['stop_loss']:
                should_close = True
                reason = "STOP PATLADI (Long Stop-Loss)"
                # Çıkış fiyatı olarak stop_loss'u baz al
                exit_price = pos['stop_loss']

        else:  # SHORT
            # SHORT için: current_high >= stop_loss ise stop patladı
            if current_high >= pos['stop_loss']:
                should_close = True
                reason = "STOP PATLADI (Short Stop-Loss)"
                # Çıkış fiyatı olarak stop_loss'u baz al
                exit_price = pos['stop_loss']

        # --- ÇIKIŞ TETİKLENDİ Mİ? ---
        if should_close:
            # === GERÇEKÇİ SİMÜLASYON KALKANI (SLIPAJ + KOMİSYON) ===

            # 1. Slipaj (Slippage) Simülasyonu
            # Stop-market emriyle çıkıldığı için fiyat kayması olur
            is_spot = pos.get('market_type', 'swap') == 'spot'
            fee_rate = self.fee_rate_spot if is_spot else self.fee_rate_futures

            if pos['direction'] == "LONG":
                # LONG çıkış (satış): Biraz daha AŞAĞIDAN sat (kötü fiyat)
                # exit_price / 1.0001 = %0.01 daha aşağıdan satış
                actual_exit_price = exit_price / 1.0001
            else:  # SHORT
                # SHORT çıkış (alış): Biraz daha YUKARIDAN al (kötü fiyat)
                # exit_price * 1.0001 = %0.01 daha yukarıdan alış
                actual_exit_price = exit_price * 1.0001

            # 2. Komisyon Hesaplama
            # Çıkış işlemi için komisyon
            exit_value_usd = pos['size'] * actual_exit_price
            exit_fee = exit_value_usd * fee_rate

            # 3. Net PnL Hesaplama
            # Giriş komisyonu zaten unrealized_usd'de var
            # Çıkış komisyonunu da ekle
            if pos['direction'] == "LONG":
                # LONG: (Çıkış Fiyatı - Giriş Fiyatı) × Boyut - Komisyonlar
                gross_pnl = (actual_exit_price - pos['entry_price']) * pos['size']
            else:  # SHORT
                # SHORT: (Giriş Fiyatı - Çıkış Fiyatı) × Boyut - Komisyonlar
                gross_pnl = (pos['entry_price'] - actual_exit_price) * pos['size']

            # Net PnL (Giriş komisyonu + Çıkış komisyonu)
            # unrealized_usd zaten giriş komisyonunu içeriyor (-fee)
            net_pnl = gross_pnl + pos['unrealized_usd'] - exit_fee

            # 4. Pozisyonu Kapat
            # İndeks bul
            pos_index = self.open_positions.index(pos)

            # Pozisyonu kapat (manuel çağrı)
            await self._close_position_with_pnl(
                index=pos_index,
                pos=pos,
                exit_price=actual_exit_price,
                net_pnl=net_pnl,
                exit_fee=exit_fee,
                reason=reason
            )

            # 5. Log Kaydı
            logger.warning(
                f"🚨 {reason} | {pos['symbol']} | "
                f"Giriş: {pos['entry_price']:.2f} | "
                f"Çıkış: {actual_exit_price:.2f} | "
                f"Stop: {pos['stop_loss']:.2f} | "
                f"PnL: ${net_pnl:.2f} | "
                f"Komisyon: ${exit_fee:.2f}"
            )

    async def _close_position_with_pnl(self, index: int, pos: dict, exit_price: float,
                                        net_pnl: float, exit_fee: float, reason: str):
        """
        Yardımcı metod: Pozisyonu hesaplanmış PnL ile kapatır.
        """
        # --- DOUBLE CLOSE (ÇİFT KAPANIŞ) KİLİDİ ---
        if pos.get('is_closing', False):
            return
        pos['is_closing'] = True
        
        from data.database import db_manager

        # Serbest marjini serbest bırak (Girişteki bloke kalkar)
        self.used_margin -= pos['margin']
        self.free_margin += pos['margin']

        # PnL ana bakiyeyi doğrudan günceller
        self.balance += net_pnl
        self.free_margin += net_pnl

        # Veri Kaydı Hazırla
        trade_record = {
            'symbol': pos['symbol'],
            'direction': pos['direction'],
            'entry_price': pos['entry_price'],
            'exit_price': exit_price,
            'size': pos['size'],
            'leverage': pos['leverage'],
            'pnl_usd': net_pnl,
            'pnl_percent': pos['pnl_percent'],
            'reason': reason,
            'strategy': pos.get('strategy', 'Bilinmiyor'),
            'timeframe': pos.get('timeframe', '1m')
        }

        # --- VERİTABANI KAYIT ---
        await db_manager.save_trade(trade_record)

        # Otomatik Kill Switch için kayıp sayacını güncelle
        self._update_consecutive_losses(net_pnl)

        # Geçmişe logla ve listeden sil
        self.trade_history.append(trade_record)
        self.open_positions.pop(index)

        # Global İstatistik Güncelleme
        self.total_trades += 1
        if net_pnl > 0:
            self.total_wins += 1
        self.total_pnl += net_pnl
        self.total_commission += exit_fee

    async def close_position_by_symbol(self, symbol: str):
        """Dışarıdan (Arayüzden) gelen kapatma isteğini işler."""
        for i, pos in enumerate(self.open_positions):
            if pos['symbol'] == symbol:
                await self._close_position(i, pos, pos['current_price'], "Kullanıcı Manuel Kapatması")
                return True
        return False

    async def _check_closure(self, index: int, pos: dict, current_price: float):
        """Anlık fiyatların hedef karı veya durdurma zararını geçip geçmediğini (Liquidation vb) kontrol eder."""
        should_close = False
        reason = ""
        
        if pos['direction'] == "LONG":
            if current_price <= pos['stop_loss']:
                should_close, reason = True, "Stop Loss (Zarar-Kes)"
            elif current_price >= pos['take_profit']:
                should_close, reason = True, "Take Profit (Kar-Al)"
        else: # SHORT
            if current_price >= pos['stop_loss']:
                should_close, reason = True, "Stop Loss (Zarar-Kes)"
            elif current_price <= pos['take_profit']:
                should_close, reason = True, "Take Profit (Kar-Al)"
        
        # Manuel arayüz kapatması için de kullanılabilir
        if should_close:
            await self._close_position(index, pos, current_price, reason)

    def activate_kill_switch(self, reason: str = "Bilinmeyen Neden"):
        """Tüm yeni işlemleri bloke eden acil durum kilidini etkinleştirir."""
        if not self.kill_switch_activated:
            self.kill_switch_activated = True
            logger.critical(f"🚨🚨🚨 KILL SWITCH AKTİFLEŞTİRİLDİ! SEBEP: {reason}. YENİ İŞLEM AÇILMAYACAK! 🚨🚨🚨")

    def reset_kill_switch(self):
        """Acil durum kilidini sıfırlar ve sistemin yeniden işlem açmasına izin verir."""
        if self.kill_switch_activated:
            self.kill_switch_activated = False
            self.consecutive_losses = 0 # Kayıp sayacını da sıfırla
            logger.warning("✅ KILL SWITCH DEAKTİVE EDİLDİ. Sistem normal operasyona döndü.")

    def _update_consecutive_losses(self, pnl: float):
        """Ardışık kayıp sayacını günceller ve eşik aşılırsa kill switch'i tetikler."""
        if self.kill_switch_activated: return # Zaten kilitliyse tekrar sayma

        if pnl < 0:
            self.consecutive_losses += 1
            logger.warning(f" consecutive loss count: {self.consecutive_losses}/{self.max_consecutive_losses}")
            if self.consecutive_losses >= self.max_consecutive_losses:
                self.activate_kill_switch(f"{self.max_consecutive_losses} ardışık zararlı işlem limiti aşıldı")
        elif pnl > 0:
            # Reset on a winning trade
            if self.consecutive_losses > 0:
                logger.info("Consecutive loss streak broken.")
            self.consecutive_losses = 0
            
    async def force_close_all(self):
        """Acil durum senaryosunda 'ACİL KİLİTLEME YÖNTEMİ' tuşu tüm işlemleri kapatır ve yeni işlem açmayı kilitler."""
        self.activate_kill_switch("Kullanıcı manuel olarak tetikledi")
        logger.warning("[PAPER TRADE] KULLANICI ACİL KAPATMA (KILL SWITCH) AKTİFLEŞTİ!")
        for pos in list(self.open_positions): # Kopya üzerinde dönerek silme sırasını bozmadan kapat
            # Pozisyonun index'ini yeniden bulalım çünkü liste değişmiş olabilir
            try:
                current_index = self.open_positions.index(pos)
                await self._close_position(current_index, pos, pos['current_price'], "Kill Switch Kapatması")
            except ValueError:
                # Pozisyon zaten başka bir coroutine tarafından kapatılmış olabilir
                pass

    async def _close_position(self, index: int, pos: dict, current_price: float, reason: str):
        """Açık pozisyonu sanal borsadan temizler ve ana bakiyeye kârları ekler/zararları çıkarır."""
        # --- DOUBLE CLOSE (ÇİFT KAPANIŞ) KİLİDİ ---
        # Eğer pozisyon zaten kapatılıyorsa, tekrar deneme
        if pos.get('is_closing', False):
            return
        pos['is_closing'] = True
        
        from data.database import db_manager # İçeride aktararak döngüsel bağımlılığı önle

        # Çıkış Komisyonu (Spot vs Futures)
        exit_value_usd = pos['size'] * current_price
        # Pozisyon açılışındaki market type'ı kullan
        is_spot = pos.get('market_type', 'futures') == 'spot'
        fee_rate = self.fee_rate_spot if is_spot else self.fee_rate_futures
        exit_fee = exit_value_usd * fee_rate

        final_pnl_usd = pos['unrealized_usd'] - exit_fee
        
        # Serbest marjini serbest bırak (Girişteki bloke kalkar)
        self.used_margin -= pos['margin']
        self.free_margin += pos['margin']
        
        # PnL ana bakiyeyi doğrudan günceller
        self.balance += final_pnl_usd
        self.free_margin += final_pnl_usd
        
        # Veri Kaydı Hazırla
        trade_record = {
            'symbol': pos['symbol'],
            'direction': pos['direction'],
            'entry_price': pos['entry_price'],
            'exit_price': current_price,
            'size': pos['size'],
            'leverage': pos['leverage'],
            'pnl_usd': final_pnl_usd,
            'pnl_percent': pos['pnl_percent'],
            'reason': reason,
            'strategy': pos.get('strategy', 'Bilinmiyor'),
            'timeframe': pos.get('timeframe', '1m')
        }
        
        # --- VERİTABANI KAYIT ---
        await db_manager.save_trade(trade_record)

        # Otomatik Kill Switch için kayıp sayacını güncelle
        self._update_consecutive_losses(final_pnl_usd)
        
        logger.info(f"[PAPER TRADE KAPAT] {pos['symbol']} | Sebep: {reason} | PnL: ${final_pnl_usd:.2f}")
        
        # Geçmişe logla ve listeden sil
        self.trade_history.append(trade_record)
        self.open_positions.pop(index)
        
        # Global İstatistik Güncelleme
        self.total_trades += 1
        if final_pnl_usd > 0: self.total_wins += 1
        self.total_pnl += final_pnl_usd
        self.total_commission += exit_fee
        
        # Max Drawdown Takibi
        equity = self.balance + sum(pos['unrealized_usd'] for pos in self.open_positions)
        if hasattr(self, 'peak_equity'):
            if equity > self.peak_equity: self.peak_equity = equity
            dd = (self.peak_equity - equity) / self.peak_equity * 100
            if not hasattr(self, 'max_drawdown') or dd > self.max_drawdown:
                self.max_drawdown = dd
        else:
            self.peak_equity = equity
            self.max_drawdown = 0.0

    def get_stats(self):
        """Dashboard için özet verileri döner."""
        win_rate = (self.total_wins / self.total_trades * 100) if self.total_trades > 0 else 0
        equity = self.balance + sum(pos['unrealized_usd'] for pos in self.open_positions)
        total_position_value = sum(pos['notional_value'] for pos in self.open_positions)
        
        # Kar Faktörü (Brüt Kar / Brüt Zarar)
        gross_profit = sum(t['pnl_usd'] for t in self.trade_history if t['pnl_usd'] > 0)
        gross_loss = abs(sum(t['pnl_usd'] for t in self.trade_history if t['pnl_usd'] < 0))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

        # Max Drawdown (Başlatılmamışsa 0 dön)
        mdd = getattr(self, 'max_drawdown', 0.0)

        return {
            "balance": self.balance,
            "equity": equity,
            "win_rate": round(win_rate, 1),
            "total_trades": self.total_trades,
            "total_pnl": round(self.total_pnl, 2),
            "total_commission": round(self.total_commission, 2),
            "used_margin": self.used_margin,
            "free_margin": self.free_margin,
            "total_notional": total_position_value,
            "avg_leverage": sum(p['leverage'] for p in self.open_positions) / len(self.open_positions) if self.open_positions else 1,
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": round(mdd, 2),
            "market_regime": self.market_regime,
            "sharpe_ratio": 1.45 # Örnek / İleride hesaplanabilir
        }

    def get_strategy_report(self):
        """Kapanan ve aktif işlemleri baz alarak stratejilerin karnesini (Röntgenini) çıkarır."""
        report = []
        groups = {}
        
        # Sadece kapanan (history) işlemleri baz alır
        for trade in self.trade_history:
            strat = trade.get('strategy', 'Bilinmiyor')
            if strat not in groups:
                groups[strat] = {"total_trades": 0, "wins": 0, "total_pnl": 0.0, "symbols": {}}
                
            groups[strat]["total_trades"] += 1
            if trade.get('pnl_usd', 0) > 0:
                groups[strat]["wins"] += 1
            groups[strat]["total_pnl"] += trade.get('pnl_usd', 0)
            
            sym = trade.get('symbol', 'Bilinmiyor')
            tf = trade.get('timeframe', '1m')
            sym_key = f"{sym} ({tf})"
            
            if sym_key not in groups[strat]["symbols"]:
                groups[strat]["symbols"][sym_key] = {"trades": 0, "wins": 0, "pnl": 0.0}
                
            groups[strat]["symbols"][sym_key]["trades"] += 1
            if trade.get('pnl_usd', 0) > 0:
                groups[strat]["symbols"][sym_key]["wins"] += 1
            groups[strat]["symbols"][sym_key]["pnl"] += trade.get('pnl_usd', 0)
            
        for strat, data in groups.items():
            win_rate = (data["wins"] / data["total_trades"] * 100) if data["total_trades"] > 0 else 0
            
            sym_perf = []
            for s_name, s_data in data["symbols"].items():
                s_wr = (s_data["wins"] / s_data["trades"] * 100) if s_data["trades"] > 0 else 0
                sym_perf.append({
                    "name": s_name,
                    "trades": s_data["trades"],
                    "win_rate": round(s_wr, 1),
                    "pnl": round(s_data["pnl"], 2)
                })
                
            # Performans Önerileri Formatında
            recommendation = ""
            if win_rate < 40 and data["total_trades"] >= 3:
                recommendation = "Düşük başarı oranı. Stop-Loss seviyesi hatalı veya işlem yapılan pariteler bu botun tarzına uymuyor (Yatay piyasa vs)."
            elif win_rate >= 60 and data["total_pnl"] > 0:
                recommendation = "Mükemmel uyum. Kârlılık ve kazanma oranı muazzam. Kaldıraç oranı ufak çaplı artırılarak gelir katlanabilir."
            elif win_rate >= 50 and data["total_pnl"] < 0:
                recommendation = "Kazanma oranı iyi fakat alınan risk (Stop L.) kârı eritiyor. Risk/Ödül oranı iyileştirilmeli veya spread/fee kontrol edilmeli."
            elif data["total_trades"] < 3:
                recommendation = "İşlem hacmi rapor ve öneri sunmak için henüz çok kısıtlı. Simülasyon devam etmeli."
            else:
                recommendation = "Ortalama bir performans. Risk toleransına göre makul sayılabilir."
                
            report.append({
                "strategy": strat,
                "total_trades": data["total_trades"],
                "win_rate": round(win_rate, 1),
                "total_pnl": round(data["total_pnl"], 2),
                "symbols": sym_perf,
                "recommendation": recommendation
            })
            
        return sorted(report, key=lambda x: x['total_pnl'], reverse=True)

# Uygulama çapında tek sanal borsa motorumuz (Singleton)
paper_engine = PaperTrader(initial_balance=10000.0)
