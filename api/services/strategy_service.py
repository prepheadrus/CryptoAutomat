"""
Strategy Service

Business logic for strategy operations.
"""

from typing import Dict, Any, List

from core.logger import logger
from strategy.manager import StrategyManager


class StrategyService:
    """
    Strategy Service.
    
    Business logic for strategy operations:
    - List strategies
    - Select strategy
    - Get strategy info
    """
    
    def __init__(self):
        self.strategy_manager = StrategyManager
    
    def get_strategies(self) -> Dict[str, Any]:
        """
        Tüm stratejileri al.
        
        Returns:
            Strateji listesi
        """
        try:
            # Her istekte dinamik stratejileri yükle
            self.strategy_manager.load_dynamic_strategies()
            
            strategies = self.strategy_manager.list_all_strategies()
            return {"status": "success", "strategies": strategies}
            
        except Exception as e:
            logger.error(f"Strateji listesi hatası: {e}")
            return {"status": "error", "message": str(e)}
    
    def select_strategy(
        self,
        symbol: str,
        strategy_id: str,
        timeframe: str = "1m",
        market_type: str = "swap",
        margin_type: str = "isolated"
    ) -> Dict[str, Any]:
        """
        Strateji seç/değiştir.
        
        Args:
            symbol: Sembol
            strategy_id: Strateji ID
            timeframe: Zaman dilimi
            market_type: Piyasa tipi
            margin_type: Marjin tipi
        
        Returns:
            Strateji seçme yanıtı
        """
        from core.paper import paper_engine
        
        logger.info(f"📥 Strateji isteği alındı: symbol={symbol}, strategy_id={strategy_id}")
        
        # Strateji başlat
        paper_engine.set_market_type(symbol, market_type)
        paper_engine.set_margin_type(symbol, margin_type)
        paper_engine.set_strategy(strategy_id, symbol, timeframe)
        
        logger.info(f"▶️ {symbol} için strateji başlatıldı: {strategy_id}")
        
        return {
            "status": "success",
            "symbol": symbol,
            "active_id": strategy_id,
            "active_timeframe": timeframe,
            "market_type": market_type,
            "margin_type": margin_type
        }
    
    def stop_strategy(self, symbol: str) -> Dict[str, Any]:
        """
        Strateji durdur.
        
        Args:
            symbol: Sembol
        
        Returns:
            Strateji durdurma yanıtı
        """
        from core.paper import paper_engine
        
        # Strateji temizle
        paper_engine.strategies[symbol] = None
        paper_engine.active_strategies[symbol] = ""
        
        logger.info(f"⏹️ {symbol} için strateji durduruldu")
        
        return {
            "status": "success",
            "symbol": symbol,
            "active_id": None
        }
