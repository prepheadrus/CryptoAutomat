"""
PaperTrader - Refactored (Event-Driven Architecture)

Eski 1,475 satırlık "God Object" iş mantığı temizlendi.
Yeni yapı:
- PositionManager, RiskEngine, BotManager instance'ları kullanır
- Event Bus'a abone olur (Pub/Sub)
- Delegation pattern ile geriye dönük uyumluluk sağlar

Usage:
    from core.paper import PaperTrader
    
    pt = PaperTrader()
    
    # Event handler'ları başlat
    await pt.start_event_handlers()
    
    # Eski API hala çalışır (delegation)
    pt.start_bot(symbol, strategy_id, timeframe)
"""

import pandas as pd
import numpy as np
import os
from typing import Dict, List, Optional, Any
from datetime import datetime

from core.logger import logger
from core.config import CONFIG

# Event Bus
from shared.events import event_bus
from shared.events.events import (
    SignalGeneratedEvent,
    PositionOpenedEvent,
    PositionClosedEvent,
    BotStartedEvent,
    BotStoppedEvent,
    PositionDirection,
    MLRecommendation
)

# New Managers (Aşama 2'de oluşturuldu)
from core.trading.position_manager import PositionManager
from core.risk.risk_engine import RiskEngine, RiskConfig
from core.bot.bot_manager import BotManager, BotConfig, BotStatus, MarketType, MarginType

# Legacy imports (geriye dönük uyumluluk)
from strategy.confluence import StrategyConfluence
from strategy.risk import RiskManagement
from strategy.manager import StrategyManager


class PaperTrader:
    """
    PaperTrader - Refactored (Event-Driven)
    
    Eski iş mantığı yeni manager'lara delegate edilir.
    Event Bus ile loose coupling sağlanır.
    """
    
    def __init__(self, initial_balance=10000.0, fee_rate_spot=0.001, fee_rate_futures=0.0004):
        """
        PaperTrader initialization.
        
        Args:
            initial_balance: Başlangıç bakiyesi
            fee_rate_spot: Spot komisyon oranı
            fee_rate_futures: Futures komisyon oranı
        """
        # ============================================
        # YENİ MANAGER INSTANCE'LARI
        # ============================================
        risk_config = RiskConfig(
            max_risk_per_trade=CONFIG['risk_management'].get('max_risk_per_trade_percent', 0.01),
            max_leverage=CONFIG['risk_management'].get('max_leverage', 10),
            max_consecutive_losses=CONFIG['risk_management'].get('max_consecutive_losses', 5)
        )
        
        self.position_manager = PositionManager(
            fee_rate_spot=fee_rate_spot,
            fee_rate_futures=fee_rate_futures
        )
        self.risk_engine = RiskEngine(config=risk_config)
        self.bot_manager = BotManager()
        
        # ============================================
        # LEGACY COMPATIBILITY (Geriye Dönük Uyumluluk)
        # ============================================
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.free_margin = initial_balance
        self.used_margin = 0.0
        
        # Legacy dicts (core/exchange.py uyumluluğu)
        self.open_positions = []  # Legacy dict list
        self.trade_history = []
        self.active_bots = {}  # bot_id -> metadata
        self.active_strategies = {}  # symbol -> strategy_id
        self.strategies = {}  # symbol -> strategy_instance
        self.active_timeframes = {}  # symbol -> timeframe
        self.market_types = {}  # symbol -> market_type
        self.margin_types = {}  # symbol -> margin_type
        self.latest_decisions = {}
        
        # Legacy state
        self.global_confidence = 0.0
        self.volatility_shield = "SAFE"
        self.kill_switch_activated = False
        self.consecutive_losses = 0
        self.market_regime = "UNKNOWN"
        
        # ML Karar Motoru
        self.ml_models = {}  # {symbol_timeframe: trainer_instance}
        self.ml_enabled = True
        
        # Event handlers
        self._event_handlers_started = False
        
        logger.info("📄 PaperTrader (Refactored) initialized")
    
    # ========================================================================
    # ML CONFIRMATION HELPERS
    # ========================================================================

    async def _get_ml_confirmation(self, symbol: str, timeframe: str, indicators: Dict[str, float]) -> Optional[Dict[str, Any]]:
        """
        ML modelinden tahmin ve güven skoru alır.
        
        Args:
            symbol: Sembol
            timeframe: Zaman dilimi
            indicators: Gelen indikatör verileri
            
        Returns:
            Dict[str, Any] or None
        """
        try:
            from ml.model_training import ModelTrainer
            cache_key = f"{symbol}_{timeframe}"
            
            # Model dosya yolunu belirle
            symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').lower()
            model_path = f"artifacts/models/xgb_model_{symbol_clean}_{timeframe}.json"
            
            if not os.path.exists(model_path):
                return None
            
            # Cache kontrolü
            if cache_key in self.ml_models:
                trainer = self.ml_models[cache_key]
            else:
                # Yeni model yükle
                trainer = ModelTrainer()
                trainer.load_model(model_path)
                self.ml_models[cache_key] = trainer
                logger.info(f"🧠 [ML] Model belleğe yüklendi: {model_path}")
            
            if not trainer.is_trained or not trainer.feature_names:
                return None
            
            # Feature mapping (indicators payload'undan model feature'larına)
            features = []
            for feat in trainer.feature_names:
                # Modelin beklediği özelliği bul, yoksa 0.0 ver
                val = indicators.get(feat, 0.0)
                features.append(float(val))
            
            # Tahmin yap
            X = pd.DataFrame([features], columns=trainer.feature_names)
            prediction = trainer.predict_single(X)
            
            return prediction
            
        except Exception as e:
            logger.error(f"❌ ML Onay hatası ({symbol}): {e}")
            return None

    # ========================================================================
    # EVENT HANDLERS (Pub/Sub)
    # ========================================================================
    
    async def start_event_handlers(self):
        """
        Event handler'ları başlat.
        Event Bus'a subscribe et.
        """
        if self._event_handlers_started:
            logger.warning("Event handler'lar zaten başlatıldı")
            return
        
        # Signal handler
        event_bus.subscribe("signal.generated", self.on_signal_generated)
        
        # Position handlers
        event_bus.subscribe("position.opened", self.on_position_opened)
        event_bus.subscribe("position.closed", self.on_position_closed)
        
        # Bot handlers
        event_bus.subscribe("bot.started", self.on_bot_started)
        event_bus.subscribe("bot.stopped", self.on_bot_stopped)
        
        self._event_handlers_started = True
        logger.info("📬 Event handlers başlatıldı")
    
    async def on_signal_generated(self, event):
        """
        Signal Generated Event Handler.

        Exchange'den gelen sinyal eventini dinler ve işlem açar.

        Args:
            event: SignalGeneratedEvent
        """
        try:
            payload = event.payload
            bot_id = payload['bot_id']
            symbol = payload['symbol']
            signal = payload['signal']  # int olarak geliyor (0, 1, 2)
            price = payload['price']
            timeframe = payload.get('timeframe', '1m')
            indicators = payload.get('indicators', {})
            metadata = payload.get('metadata', {})

            logger.info(f"📬 Sinyal alındı: {bot_id} signal={signal}")

            # HOLD ise işlem yapma (signal int olarak geliyor)
            if signal == 1:  # SignalType.HOLD.value = 1
                return

            # Bot çalışıyor mu kontrol et
            if not self.bot_manager.is_bot_running(bot_id):
                logger.warning(f"Bot çalışmıyor: {bot_id}")
                return

            # Strateji al
            strategy = self.strategies.get(symbol)
            if strategy is None:
                logger.warning(f"Strateji bulunamadı: {symbol}")
                return

            # HTF kontrolü (metadata'dan)
            htf_trends = metadata.get('htf_trends', {})
            htf_trend = metadata.get('htf_trend', 'NEUTRAL')

            # HTF filter (Legacy logic)
            if htf_trends:
                htf_levels = list(htf_trends.keys())
                if htf_levels:
                    major_htf = htf_levels[-1]
                    bull_count = sum(1 for tf in htf_levels if htf_trends.get(tf) == 'BULL')
                    bear_count = sum(1 for tf in htf_levels if htf_trends.get(tf) == 'BEAR')

                    # LONG için: Major HTF BEAR olmamalı (signal = 2)
                    if signal == 2:  # SignalType.LONG.value = 2
                        if htf_trends.get(major_htf) == 'BEAR' or bull_count == 0:
                            logger.info(f"🛡️ [FILTER] HTF Trend Engelleyici: {symbol} LONG reddedildi (Major HTF BEAR)")
                            return

                    # SHORT için: Major HTF BULL olmamalı (signal = 0)
                    elif signal == 0:  # SignalType.SHORT.value = 0
                        if htf_trends.get(major_htf) == 'BULL' or bear_count == 0:
                            logger.info(f"🛡️ [FILTER] HTF Trend Engelleyici: {symbol} SHORT reddedildi (Major HTF BULL)")
                            return
            
            # Risk kontrolü
            if not self.risk_engine.can_open_position(len(self.position_manager.get_all_positions())):
                logger.warning("Risk kontrolü başarısız")
                return
            
            # Pozisyon zaten var mı?
            existing_position = self.position_manager.get_position(bot_id)
            if existing_position:
                logger.info(f"ℹ️ Pozisyon zaten açık: {bot_id}")
                return
            
            # ============================================
            # ML KARAR MOTORU (ML CONFIRMATION LAYER)
            # ============================================
            ml_confirmed = True
            ml_confidence = 0.5
            ml_rec = "HOLD"

            if self.ml_enabled:
                ml_data = await self._get_ml_confirmation(symbol, timeframe, indicators)
                if ml_data:
                    ml_rec = ml_data.get('recommendation', 'HOLD')
                    ml_confidence = ml_data.get('confidence', 0.5)
                    
                    # Filtreleme Mantığı (Conflict Resolution)
                    if signal == 2 and "SHORT" in ml_rec:  # Direction: LONG
                        logger.info(f"🛡️ [ML FILTER] {symbol} LONG reddedildi: ML zıt yön gösteriyor ({ml_rec}) | Conf: {ml_confidence:.2f}")
                        ml_confirmed = False
                    
                    elif signal == 0 and "LONG" in ml_rec: # Direction: SHORT
                        logger.info(f"🛡️ [ML FILTER] {symbol} SHORT reddedildi: ML zıt yön gösteriyor ({ml_rec}) | Conf: {ml_confidence:.2f}")
                        ml_confirmed = False
                    
                    # Nötr (Hold) durumu konfigürasyona bağlı olarak engellenebilir
                    elif ml_rec == "HOLD" and ml_confidence < 0.40:
                        logger.info(f"🛡️ [ML FILTER] {symbol} reddedildi: ML belirsiz (HOLD) | Conf: {ml_confidence:.2f}")
                        ml_confirmed = False
                    else:
                        logger.info(f"🧠 [ML CONFIRMED] {symbol} | Rec: {ml_rec} | Conf: {ml_confidence:.2f}")
                else:
                    logger.debug(f"ℹ️ {symbol} için aktif ML modeli bulunamadı, sadece teknik sinyal ile gidiliyor.")

            # Dashboard için en son kararı kaydet
            self.latest_decisions[symbol] = {
                'signal_val': signal,
                'signal_text': "LONG" if signal == 2 else "SHORT" if signal == 0 else "HOLD",
                'price': price,
                'time': datetime.utcnow().isoformat(),
                'ml_rec': ml_rec,
                'ml_confidence': ml_confidence,
                'ml_confirmed': ml_confirmed,
                'htf_trend': htf_trend
            }

            # ML onayı yoksa dur
            if not ml_confirmed:
                return

            # ============================================
            # POZİSYON AÇ (PositionManager'a delegate)
            # ============================================
            atr = indicators.get('ATR_14', price * 0.01)
            stop_params = strategy.get_stop_params()
            atr_multiplier = stop_params.get('atr_multiplier', 3.0)

            # Stop loss / take profit hesapla
            direction = "LONG" if signal == 2 else "SHORT"  # 2=LONG, 0=SHORT
            stop_loss, take_profit = self.risk_engine.calculate_dynamic_stops(
                price=price,
                direction=direction,
                atr=atr,
                multiplier=atr_multiplier
            )
            
            # Pozisyon boyutu hesapla
            risk_percent = CONFIG['risk_management'].get('max_risk_per_trade_percent', 0.2)
            size = self.risk_engine.calculate_position_size(
                account_balance=self.balance,
                entry_price=price,
                stop_loss_price=stop_loss,
                risk_percentage=risk_percent
            )
            
            # Kaldıraç (ML yoksa varsayılan)
            leverage = CONFIG['risk_management'].get('default_leverage', 1.0)
            
            # Pozisyon aç
            position = self.position_manager.open_position(
                bot_id=bot_id,
                symbol=symbol,
                direction=direction,
                entry_price=price,
                size=size,
                leverage=leverage,
                stop_loss=stop_loss,
                take_profit=take_profit,
                atr=atr,
                atr_multiplier=atr_multiplier,
                strategy_name=strategy.name(),
                timeframe=timeframe
            )
            
            if position:
                # Legacy positions güncelle
                self.open_positions = self.position_manager.legacy_positions
                
                logger.info(f"✅ Pozisyon açıldı: {bot_id} {direction} @ {price:.2f}")
            
        except Exception as e:
            logger.error(f"Signal handler hatası: {e}", exc_info=True)
    
    async def on_position_opened(self, event):
        """
        Position Opened Event Handler.
        
        Args:
            event: PositionOpenedEvent
        """
        payload = event.payload
        bot_id = payload.get('bot_id')
        symbol = payload.get('symbol')
        
        logger.info(f"📊 Pozisyon açıldı: {bot_id} {symbol}")
        
        # Bot state güncelle
        self.bot_manager.update_bot_margin(bot_id, payload.get('margin', 0.0))
    
    async def on_position_closed(self, event):
        """
        Position Closed Event Handler.
        
        Args:
            event: PositionClosedEvent
        """
        payload = event.payload
        bot_id = payload.get('bot_id')
        pnl = payload.get('pnl', 0.0)
        
        logger.info(f"❌ Pozisyon kapatıldı: {bot_id} PnL=${pnl:.2f}")
        
        # Bakiyeyi güncelle
        self.balance += pnl
        # Free margin'i güncelle (Basit model)
        self.free_margin = self.balance
        self.used_margin = 0.0 # Bireysel botlara bakılacak
        
        # Risk engine'e kaydet
        self.risk_engine.record_trade_result(pnl)
        
        # Bot state güncelle
        self.bot_manager.record_bot_trade(bot_id, pnl)
        
        # Kill switch kontrolü
        if self.risk_engine.kill_switch_active:
            self.kill_switch_activated = True
            logger.critical("🚨 KILL SWITCH AKTİF!")
    
    async def on_bot_started(self, event):
        """Bot Started Event Handler"""
        payload = event.payload
        logger.info(f"🚀 Bot başlatıldı: {payload.get('bot_id')}")
    
    async def on_bot_stopped(self, event):
        """Bot Stopped Event Handler"""
        payload = event.payload
        logger.info(f"🛑 Bot durduruldu: {payload.get('bot_id')}")
    
    # ========================================================================
    # DELEGATION METHODS (Legacy API Uyumluluğu)
    # ========================================================================
    
    def start_bot(self, symbol: str, strategy_id: str, timeframe: str = "1m", market_type: str = "swap") -> str:
        """
        Bot başlat (legacy API -> BotManager'a delegate).
        
        Args:
            symbol: Sembol
            strategy_id: Strateji ID
            timeframe: Timeframe
            market_type: Market type
        
        Returns:
            Bot ID
        """
        # Bot config oluştur
        config = BotConfig(
            symbol=symbol,
            strategy_id=strategy_id,
            timeframe=timeframe,
            market_type=MarketType(market_type.lower())
        )
        
        # Bot başlat
        bot_id = self.bot_manager.start_bot(config)
        
        # Legacy tracking
        self.active_bots[bot_id] = {
            'symbol': symbol,
            'strategy_id': strategy_id,
            'timeframe': timeframe,
            'market_type': market_type,
            'status': 'running'
        }
        self.active_strategies[symbol] = strategy_id
        self.active_timeframes[symbol] = timeframe
        self.market_types[symbol] = market_type
        
        # Strateji instance al
        strategy = StrategyManager.get_strategy(strategy_id)
        self.strategies[symbol] = strategy
        
        logger.info(f"🚀 Bot başlatıldı: {bot_id}")
        return bot_id
    
    def stop_bot(self, bot_id: str) -> bool:
        """Bot durdur (BotManager'a delegate)"""
        return self.bot_manager.stop_bot(bot_id)
    
    def resume_bot(self, bot_id: str) -> bool:
        """Bot devam et (BotManager'a delegate)"""
        return self.bot_manager.resume_bot(bot_id)
    
    def remove_bot(self, bot_id: str) -> bool:
        """Bot sil (BotManager'a delegate)"""
        success = self.bot_manager.remove_bot(bot_id)
        if success and bot_id in self.active_bots:
            del self.active_bots[bot_id]
        return success
    
    async def close_position_by_symbol(self, symbol: str) -> bool:
        """
        Pozisyon kapat (PositionManager'a delegate).
        
        Args:
            symbol: Sembol
        
        Returns:
            True ise başarılı
        """
        # Sembol için pozisyon bul
        positions = self.position_manager.get_positions_by_symbol(symbol)
        if not positions:
            return False
        
        # İlk pozisyonu kapat
        position = positions[0]
        current_price = position.metadata.get('current_price', position.entry_price)
        
        await self.position_manager.close_position(
            bot_id=position.bot_id,
            exit_price=current_price,
            reason="manual"
        )
        
        # Legacy update
        self.open_positions = self.position_manager.legacy_positions
        
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """
        İstatistikler (tüm manager'lardan).

        Returns:
            Dict with all stats
        """
        # Toplam unrealized PnL ve kullanılan marjin
        unrealized_pnl = 0.0
        used_margin = 0.0
        for pos in self.position_manager.legacy_positions:
            unrealized_pnl += pos.get('unrealized_usd', 0.0)
            used_margin += pos.get('margin', 0.0)
            
        equity = self.balance + unrealized_pnl
        free_margin = self.balance - used_margin
        
        # Legacy değişkenleri güncelle (UI için değil, iç mantık için gerekebilir)
        self.used_margin = used_margin
        self.free_margin = free_margin
        
        return {
            'balance': self.balance,
            'free_margin': free_margin,
            'used_margin': used_margin,
            'equity': equity,
            'unrealized_pnl': unrealized_pnl,
            'total_trades': self.position_manager.total_trades,
            'total_wins': self.position_manager.total_wins,
            'win_rate': self.position_manager.total_wins / max(1, self.position_manager.total_trades),
            'total_pnl': self.position_manager.total_pnl,
            'total_commission': self.position_manager.total_commission,
            'bot_stats': self.bot_manager.get_stats(),
            'risk_stats': self.risk_engine.get_stats(),
            'position_stats': self.position_manager.get_stats()
        }

    def get_strategy_report(self) -> List[Dict[str, Any]]:
        """
        Kapanan işlemleri baz alarak stratejilerin karnesini (röntgenini) çıkarır.
        
        Returns:
            List of strategy reports sorted by total_pnl
        """
        report = []
        groups = {}

        # Sadece kapanan (history) işlemleri baz alır
        for trade in self.trade_history:
            strat = trade.get('strategy', 'Bilinmiyor')
            if strat not in groups:
                groups[strat] = {
                    "total_trades": 0,
                    "wins": 0,
                    "total_pnl": 0.0,
                    "symbols": {}
                }

            groups[strat]["total_trades"] += 1
            if trade.get('pnl_usd', 0) > 0:
                groups[strat]["wins"] += 1
            groups[strat]["total_pnl"] += trade.get('pnl_usd', 0)

            sym = trade.get('symbol', 'Bilinmiyor')
            tf = trade.get('timeframe', '1m')
            sym_key = f"{sym} ({tf})"

            if sym_key not in groups[strat]["symbols"]:
                groups[strat]["symbols"][sym_key] = {
                    "trades": 0,
                    "wins": 0,
                    "pnl": 0.0
                }

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

            # Performans Önerileri
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

    def get_all_bots(self) -> List[Dict[str, Any]]:
        """
        Tüm botları listele. BotManager'dan güncel verileri (PnL, İşlem Sayısı vb.) çeker.

        Returns:
            Bot listesi (detaylı metriklerle birlikte)
        """
        bots = []
        for bot_id, bot in self.bot_manager.bots.items():
            state = bot.state
            config = bot.config
            
            # PnL yüzde hesapla (Bakiye bazlı basit oran)
            pnl_percent = (state.pnl / self.initial_balance * 100) if self.initial_balance > 0 else 0.0

            bots.append({
                'bot_id': bot_id,
                'symbol': config.symbol,
                'strategy_id': config.strategy_id,
                'timeframe': config.timeframe,
                'market_type': config.market_type.value,
                'status': state.status.value,
                'pnl': round(state.pnl, 2),
                'pnl_percent': round(pnl_percent, 2),
                'margin': round(state.margin, 2),
                'trades': state.trades,
                'wins': state.wins,
                'started_at': bot.started_at.isoformat(),
                'last_signal_at': state.last_signal_at.isoformat() if state.last_signal_at else None
            })
        return bots

    # ========================================================================
    # LEGACY COMPATIBILITY (Eski Metodlar - Delegate)
    # ========================================================================
    
    async def update_live_prices(self, symbol: str, current_price: float):
        """
        Canlı fiyat güncelleme (legacy).
        
        Args:
            symbol: Sembol
            current_price: Şu anki fiyat
        """
        # Legacy positions güncelle
        for pos in self.position_manager.legacy_positions:
            if pos['symbol'] == symbol:
                pos['current_price'] = current_price
                
                # Trailing stop güncelle
                self.position_manager.update_trailing_stop_legacy(
                    pos, current_price, current_price
                )
                
                # PnL hesapla
                _, pnl_usd = self.position_manager.get_unrealized_pnl_legacy(pos, current_price)
                pos['unrealized_usd'] = pnl_usd
    
    @property
    def timeframe(self):
        """Legacy compatibility"""
        return next(iter(self.active_timeframes.values())) if self.active_timeframes else "1m"


# ============================================================================
# GLOBAL INSTANCE (Singleton)
# ============================================================================

# Eski kodlarla uyumluluk için global instance
paper_engine = PaperTrader()
