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
        
        # ML (legacy)
        self.ml_model = None
        self.ml_enabled = False
        
        # Event handlers
        self._event_handlers_started = False
        
        logger.info("📄 PaperTrader (Refactored) initialized")
    
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

            logger.debug(f"📬 Signal event received: {bot_id} signal={signal}")

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

                    # LONG için: Major HTF BEAR olmamalı (signal = 0)
                    if signal == 0:  # SignalType.LONG.value = 0
                        if htf_trends.get(major_htf) == 'BEAR' or bull_count == 0:
                            logger.debug(f"HTF filter: LONG reddedildi")
                            return

                    # SHORT için: Major HTF BULL olmamalı (signal = 2)
                    elif signal == 2:  # SignalType.SHORT.value = 2
                        if htf_trends.get(major_htf) == 'BULL' or bear_count == 0:
                            logger.debug(f"HTF filter: SHORT reddedildi")
                            return
            
            # Risk kontrolü
            if not self.risk_engine.can_open_position(len(self.position_manager.get_all_positions())):
                logger.warning("Risk kontrolü başarısız")
                return
            
            # Pozisyon zaten var mı?
            existing_position = self.position_manager.get_position(bot_id)
            if existing_position:
                logger.debug(f"Pozisyon zaten açık: {bot_id}")
                return
            
            # ============================================
            # POZİSYON AÇ (PositionManager'a delegate)
            # ============================================
            atr = indicators.get('ATR_14', price * 0.01)
            stop_params = strategy.get_stop_params()
            atr_multiplier = stop_params.get('atr_multiplier', 3.0)

            # Stop loss / take profit hesapla
            direction = "LONG" if signal == 0 else "SHORT"  # 0=LONG, 2=SHORT
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
        return {
            'balance': self.balance,
            'free_margin': self.free_margin,
            'used_margin': self.used_margin,
            'total_trades': self.position_manager.total_trades,
            'total_wins': self.position_manager.total_wins,
            'win_rate': self.position_manager.total_wins / max(1, self.position_manager.total_trades),
            'total_pnl': self.position_manager.total_pnl,
            'bot_stats': self.bot_manager.get_stats(),
            'risk_stats': self.risk_engine.get_stats(),
            'position_stats': self.position_manager.get_stats()
        }

    def get_all_bots(self) -> List[Dict[str, Any]]:
        """
        Tüm aktif botları listele.

        Returns:
            Bot listesi
        """
        bots = []
        for bot_id, bot_info in self.active_bots.items():
            bots.append({
                'bot_id': bot_id,
                'symbol': bot_info.get('symbol', ''),
                'strategy_id': bot_info.get('strategy_id', ''),
                'timeframe': bot_info.get('timeframe', '1m'),
                'market_type': bot_info.get('market_type', 'swap'),
                'status': bot_info.get('status', 'running'),
                'pnl': bot_info.get('pnl', 0.0),
                'margin': bot_info.get('margin', 0.0),
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
