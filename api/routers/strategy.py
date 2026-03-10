"""
Strategy Router

FastAPI router for strategy operations.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List, Optional

from core.logger import logger
from api.schemas.strategy import StrategySelectRequest
from api.services.strategy_service import StrategyService

router = APIRouter(prefix="/api/v1", tags=["Strategy"])

strategy_service = StrategyService()


@router.get("/strategies")
async def get_strategy_list() -> Dict[str, Any]:
    """
    Sistemdeki tüm stratejileri döner (builtin + custom).
    """
    return strategy_service.get_strategies()


@router.post("/strategy/select")
async def change_strategy(
    symbol: str,
    strategy_id: Optional[str] = None,
    timeframe: str = "1m",
    market_type: str = "swap",
    margin_type: str = "isolated"
) -> Dict[str, Any]:
    """
    Botun stratejisini anında değiştirir.
    strategy_id boş ise strateji durdurulur.
    """
    if strategy_id:
        return strategy_service.select_strategy(
            symbol=symbol,
            strategy_id=strategy_id,
            timeframe=timeframe,
            market_type=market_type,
            margin_type=margin_type
        )
    else:
        return strategy_service.stop_strategy(symbol)
