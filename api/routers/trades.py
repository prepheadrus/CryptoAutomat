"""
Trades Router

FastAPI router for trade history and analytics.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, List, Optional
from datetime import datetime

from core.logger import logger
from data.database import db_manager

router = APIRouter(prefix="/api/v1/trades", tags=["Trades"])


@router.get("/history")
async def get_trade_history(
    symbol: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000)
) -> Dict[str, Any]:
    """
    Kalıcı veritabanından işlem geçmişini döner.
    """
    try:
        # DB'den çek
        trades = await db_manager.get_recent_trades(limit=limit)
        
        # Filtreleme (DB seviyesinde de yapılabilir ama şimdilik kod tarafında basitleştirelim)
        if symbol:
            trades = [t for t in trades if t['symbol'] == symbol]
            
        return {
            "status": "success",
            "count": len(trades),
            "trades": trades
        }
    except Exception as e:
        logger.error(f"Trade history error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "trades": []
        }


@router.delete("/clear")
async def clear_trade_history() -> Dict[str, Any]:
    """
    Tüm işlem geçmişini veritabanından siler.
    """
    try:
        await db_manager.clear_trade_history()
        return {
            "status": "success",
            "message": "Tüm işlem geçmişi başarıyla temizlendi."
        }
    except Exception as e:
        logger.error(f"Clear trade history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_trade_stats() -> Dict[str, Any]:
    """
    İşlem geçmişine dayalı genel istatistikleri döner.
    """
    try:
        trades = await db_manager.get_recent_trades(limit=1000)
        
        if not trades:
            return {
                "status": "success",
                "stats": {
                    "total_trades": 0,
                    "win_rate": 0,
                    "total_pnl": 0,
                    "avg_pnl": 0,
                    "winning_trades": 0,
                    "losing_trades": 0
                }
            }
            
        winning_trades = [t for t in trades if (t['pnl_usd'] or 0) > 0]
        losing_trades = [t for t in trades if (t['pnl_usd'] or 0) <= 0]
        
        total_pnl = sum(t['pnl_usd'] or 0 for t in trades)
        win_rate = (len(winning_trades) / len(trades)) * 100
        
        # Strateji bazlı gruplama
        strategy_stats = {}
        for t in trades:
            s_id = t.get('strategy_id') or 'Bilinmeyen'
            if s_id not in strategy_stats:
                strategy_stats[s_id] = {"count": 0, "pnl": 0}
            strategy_stats[s_id]["count"] += 1
            strategy_stats[s_id]["pnl"] += (t['pnl_usd'] or 0)
            
        # En iyi strateji
        best_strategy = "N/A"
        if strategy_stats:
            best_strategy = max(strategy_stats.items(), key=lambda x: x[1]['pnl'])[0]

        return {
            "status": "success",
            "stats": {
                "total_trades": len(trades),
                "win_rate": round(win_rate, 2),
                "total_pnl": round(total_pnl, 2),
                "avg_pnl": round(total_pnl / len(trades), 2),
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "best_strategy": best_strategy,
                "strategy_count": len(strategy_stats)
            }
        }
    except Exception as e:
        logger.error(f"Trade stats error: {e}")
        return {"status": "error", "message": str(e)}
