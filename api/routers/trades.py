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
    Kalıcı veritabanından ve mevcut oturumdaki (memory) işlem geçmişini döner.
    """
    try:
        from core.paper import paper_engine
        
        # 1. DB'den çek
        db_trades = await db_manager.get_recent_trades(limit=limit)
        
        # 2. Memory'den çek (Mevcut oturum verileri)
        memory_trades = []
        if hasattr(paper_engine.position_manager, 'trade_history'):
            mem_raw = paper_engine.position_manager.trade_history.get_recent(limit)
            for t in mem_raw:
                # DB formatına normalize et
                trade_dict = t.to_dict()
                memory_trades.append({
                    "id": trade_dict.get('id'),
                    "symbol": trade_dict.get('symbol'),
                    "direction": trade_dict.get('direction'),
                    "entry_price": trade_dict.get('entry_price'),
                    "exit_price": trade_dict.get('exit_price'),
                    "size": trade_dict.get('size'),
                    "leverage": trade_dict.get('leverage'),
                    "pnl_usd": trade_dict.get('pnl'),
                    "pnl_percent": trade_dict.get('pnl_percent', 0.0), # Convert Enum to %
                    "reason": trade_dict.get('reason'),
                    "strategy_id": trade_dict.get('strategy_id'),
                    "closed_at": trade_dict.get('closed_at')
                })
        
        # 3. Merge (ID bazlı tekleştir)
        seen_ids = {t['id'] for t in db_trades if 'id' in t}
        all_trades = db_trades + [t for t in memory_trades if t['id'] not in seen_ids]
        
        # 4. Filtreleme
        if symbol:
            all_trades = [t for t in all_trades if t['symbol'] == symbol]
            
        # 5. Sıralama (en yeni en üstte) - DÜZELTME
        def get_sort_key(trade):
            closed_at = trade.get('closed_at')
            if isinstance(closed_at, datetime):
                return closed_at
            if isinstance(closed_at, str) and closed_at:
                try:
                    return datetime.fromisoformat(closed_at.replace('Z', '+00:00'))
                except ValueError:
                    return datetime.min
            return datetime.min

        all_trades.sort(key=get_sort_key, reverse=True)
            
        return {
            "status": "success",
            "count": len(all_trades),
            "trades": all_trades[:limit]
        }
    except Exception as e:
        logger.error(f"Trade history error: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
    İşlem geçmişine (DB + Memory) dayalı genel istatistikleri döner.
    """
    try:
        from core.paper import paper_engine
        
        # 1. DB'den çek
        db_trades = await db_manager.get_recent_trades(limit=1000)
        
        # 2. Memory'den çek
        memory_trades = []
        if hasattr(paper_engine.position_manager, 'trade_history'):
            mem_raw = paper_engine.position_manager.trade_history.trades
            for t in mem_raw:
                trade_dict = t.to_dict()
                memory_trades.append({
                    "id": trade_dict.get('id'),
                    "pnl_usd": trade_dict.get('pnl'),
                    "strategy_id": trade_dict.get('strategy_id')
                })
        
        # 3. Merge
        seen_ids = {t['id'] for t in db_trades if 'id' in t}
        all_trades = db_trades + [t for t in memory_trades if t['id'] not in seen_ids]
        
        if not all_trades:
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
            
        winning_trades = [t for t in all_trades if (t.get('pnl_usd') or 0) > 0]
        losing_trades = [t for t in all_trades if (t.get('pnl_usd') or 0) <= 0]
        
        total_pnl = sum(t.get('pnl_usd') or 0 for t in all_trades)
        win_rate = (len(winning_trades) / len(all_trades)) * 100
        
        # Strateji bazlı gruplama
        strategy_stats = {}
        for t in all_trades:
            s_id = t.get('strategy_id') or 'Bilinmeyen'
            if s_id not in strategy_stats:
                strategy_stats[s_id] = {"count": 0, "pnl": 0}
            strategy_stats[s_id]["count"] += 1
            strategy_stats[s_id]["pnl"] += (t.get('pnl_usd') or 0)
            
        # En iyi strateji
        best_strategy = "N/A"
        if strategy_stats:
            best_strategy = max(strategy_stats.items(), key=lambda x: x[1]['pnl'])[0]

        return {
            "status": "success",
            "stats": {
                "total_trades": len(all_trades),
                "win_rate": round(win_rate, 2),
                "total_pnl": round(total_pnl, 2),
                "avg_pnl": round(total_pnl / len(all_trades), 2),
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "best_strategy": best_strategy,
                "strategy_count": len(strategy_stats)
            }
        }
    except Exception as e:
        logger.error(f"Trade stats error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {"status": "error", "message": str(e)}
