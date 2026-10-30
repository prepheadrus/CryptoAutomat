"""
Data Router

FastAPI router for data operations.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, List

from core.logger import logger
from api.schemas.data import (
    DataDownloadRequest,
    DataStopRequest,
    DataResumeRequest,
    DataDeleteRequest,
    DataPauseRequest,
)
from api.services.data_service import DataService

router = APIRouter(prefix="/api/v1/data", tags=["Data"])

data_service = DataService()


@router.get("/history-status")
async def get_history_status(symbol: str, timeframe: str = "1m") -> Dict[str, Any]:
    """
    Returns date range in database for the selected symbol.
    """
    return await data_service.get_history_status(symbol, timeframe)


@router.post("/download-history")
async def start_historical_download(
    request: DataDownloadRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Starts background historical data ingestion.
    """
    return await data_service.start_download(request)


@router.post("/stop-download")
async def stop_historical_download(request: DataStopRequest) -> Dict[str, Any]:
    """
    Stops ongoing data ingestion.
    """
    return await data_service.stop_download(request)


@router.post("/resume-download")
async def resume_historical_download(request: DataResumeRequest) -> Dict[str, Any]:
    """
    Resumes paused data ingestion.
    """
    return await data_service.resume_download(request)


@router.get("/active-downloads")
async def get_active_downloads() -> Dict[str, Any]:
    """
    Returns active ingestion tasks.
    """
    return await data_service.get_active_downloads()


@router.get("/all-download-tasks")
async def get_all_download_tasks() -> Dict[str, Any]:
    """
    Returns all ingestion tasks (active + completed).
    """
    return await data_service.get_all_download_tasks()


@router.post("/delete-task")
async def delete_klines_data(request: DataDeleteRequest) -> Dict[str, Any]:
    """
    Deletes klines data from database (symbol + timeframe).
    """
    return await data_service.delete_data(request)


@router.post("/delete-download-task")
async def delete_download_task(request: DataDeleteRequest) -> Dict[str, Any]:
    """
    Deletes task from download tasks table (symbol + market_type).
    Used to clean up completed or stopped tasks.
    """
    return await data_service.delete_download_task(request)


@router.delete("/delete-all")
async def delete_all_klines_data() -> Dict[str, Any]:
    """
    Deletes ALL klines data from database.
    CAUTION: Irreversible!
    """
    return await data_service.delete_all_klines()


@router.delete("/delete-klines")
async def delete_klines_by_symbol(request: DataDeleteRequest) -> Dict[str, Any]:
    """
    Deletes ALL klines data for a specific symbol.
    """
    return await data_service.delete_data(request)


@router.post("/toggle-pause")
async def toggle_pause(request: DataPauseRequest) -> Dict[str, Any]:
    """
    Pauses or resumes ingestion task.
    """
    return await data_service.pause_download(request)


@router.get("/symbols-with-data")
async def get_symbols_with_data() -> Dict[str, Any]:
    """
    Returns all symbols with stored data in database.
    """
    return await data_service.get_symbols_with_data()


@router.get("/check-data-gaps")
async def check_data_gaps(symbol: str = None) -> Dict[str, Any]:
    """
    Check data gaps for all symbols or a specific symbol.

    Args:
        symbol: Sembol (opsiyonel, yoksa tüm semboller)

    Returns:
        {
            "status": "success",
            "gaps": [
                {
                    "symbol": "BTC/USDT",
                    "gap_start": "2025-01-15 10:00",
                    "gap_end": "2025-01-30 14:30",
                    "gap_minutes": 21930,
                    "gap_days": 15.2
                }
            ]
        }
    """
    return await data_service.check_data_gaps(symbol)


@router.post("/fill-data-gaps")
async def fill_data_gaps(symbol: str = None) -> Dict[str, Any]:
    """
    Automatically fill data gaps for all symbols or a specific symbol.

    Args:
        symbol: Sembol (opsiyonel, yoksa tüm semboller)

    Returns:
        {
            "status": "success",
            "message": "5 sembolün boşlukları dolduruldu",
            "filled": [...]
        }
    """
    return await data_service.fill_data_gaps(symbol)


@router.get("/data-count")
async def get_data_count(symbol: str, timeframe: str = "1m") -> Dict[str, Any]:
    """
    Returns candle count for specific symbol and timeframe.
    
    Args:
        symbol: Sembol (örn: BTC/USDT)
        timeframe: Zaman dilimi
    
    Returns:
        {
            "status": "success",
            "symbol": "BTC/USDT",
            "timeframe": "1m",
            "count": 50000,
            "min_date": "2024-01-01",
            "max_date": "2026-03-10"
        }
    """
    try:
        from data.database import db_manager
        
        count = await db_manager.get_klines_count(symbol, timeframe)
        
        # Tarih aralığını al
        date_range = await db_manager.get_candle_range(symbol, timeframe)
        
        return {
            "status": "success",
            "symbol": symbol,
            "timeframe": timeframe,
            "count": count,
            "min_date": date_range.get('start_date') if date_range else None,
            "max_date": date_range.get('end_date') if date_range else None
        }
        
    except Exception as e:
        logger.error(f"Data count error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "count": 0
        }


@router.get("/inventory")
async def get_data_inventory() -> Dict[str, Any]:
    """
    Returns database inventory (total candles + symbol/timeframe breakdown).
    """
    return await data_service.get_data_inventory()


@router.get("/stats")
async def get_database_stats() -> Dict[str, Any]:
    """
    Returns database summary statistics (total candles + symbol breakdown).
    """
    return await data_service.get_database_stats()


# ============================================================================
# COMPATIBILITY ENDPOINTS (Frontend uyumluluğu için)
# ============================================================================

@router.get("/symbols")
async def get_symbols_alias() -> Dict[str, Any]:
    """
    COMPATIBILITY: /api/v1/data/symbols endpoint'i
    Frontend uyumluluğu için alias.
    """
    return await data_service.get_symbols_with_data()
