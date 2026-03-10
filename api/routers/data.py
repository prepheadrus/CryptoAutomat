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
    Seçili sembolün veritabanındaki tarih aralığını döner.
    """
    return await data_service.get_history_status(symbol, timeframe)


@router.post("/download-history")
async def start_historical_download(
    request: DataDownloadRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """
    Arka planda geçmiş veri indirme işlemini başlatır.
    """
    return await data_service.start_download(request)


@router.post("/stop-download")
async def stop_historical_download(request: DataStopRequest) -> Dict[str, Any]:
    """
    Devam eden indirme işlemini durdurur.
    """
    return await data_service.stop_download(request)


@router.post("/resume-download")
async def resume_historical_download(request: DataResumeRequest) -> Dict[str, Any]:
    """
    Duraklatılmış indirme işlemini devam ettirir.
    """
    return await data_service.resume_download(request)


@router.get("/active-downloads")
async def get_active_downloads() -> Dict[str, Any]:
    """
    Aktif indirme görevlerini döner.
    """
    return await data_service.get_active_downloads()


@router.get("/all-download-tasks")
async def get_all_download_tasks() -> Dict[str, Any]:
    """
    Tüm indirme görevlerini döner (aktif + tamamlanan).
    """
    return await data_service.get_all_download_tasks()


@router.post("/delete-task")
async def delete_klines_data(request: DataDeleteRequest) -> Dict[str, Any]:
    """
    Veritabanından klines verisini siler (symbol + timeframe).
    """
    return await data_service.delete_data(request)


@router.post("/delete-download-task")
async def delete_download_task(request: DataDeleteRequest) -> Dict[str, Any]:
    """
    Download tasks tablosundan görevi siler (symbol + market_type).
    Tamamlanmış veya durdurulmuş görevleri temizlemek için kullanılır.
    """
    return await data_service.delete_download_task(request)


@router.post("/toggle-pause")
async def toggle_pause(request: DataPauseRequest) -> Dict[str, Any]:
    """
    İndirme işlemini duraklatır/devam ettirir.
    """
    return await data_service.pause_download(request)


@router.get("/symbols-with-data")
async def get_symbols_with_data() -> Dict[str, Any]:
    """
    Veritabanında verisi olan tüm sembolleri döner.
    """
    return await data_service.get_symbols_with_data()


@router.get("/inventory")
async def get_data_inventory() -> Dict[str, Any]:
    """
    Veritabanı envanterini döner (toplam mum + sembol/timeframe bazlı detay).
    """
    return await data_service.get_data_inventory()


@router.get("/stats")
async def get_database_stats() -> Dict[str, Any]:
    """
    Veritabanı özet istatistiklerini döner (toplam mum + sembol bazlı özet).
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
