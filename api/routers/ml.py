"""
ML Router

FastAPI router for ML operations.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from core.logger import logger
from api.schemas.ml import MLTrainRequest
from api.services.ml_service import MLService

router = APIRouter(prefix="/api/v1/ml", tags=["ML"])

ml_service = MLService()


@router.post("/train")
async def train_ml_model(request: MLTrainRequest) -> Dict[str, Any]:
    """
    ML modelini eğitir. Arka planda çalışır.
    """
    result = await ml_service.train_model(request)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    return result


@router.get("/status")
async def get_ml_status() -> Dict[str, Any]:
    """
    ML eğitim durumunu döner.
    """
    return ml_service.get_training_status()


@router.get("/training-history")
async def get_training_history(limit: int = 50) -> Dict[str, Any]:
    """
    ML eğitim geçmişini döner.
    """
    return ml_service.get_training_history(limit)


@router.delete("/training-history")
async def delete_training_history() -> Dict[str, Any]:
    """
    ML eğitim geçmişini siler.
    """
    return ml_service.delete_training_history()


@router.get("/check-model")
async def check_model(symbol: str, timeframe: str = "1h") -> Dict[str, Any]:
    """
    ML modelinin varlığını kontrol eder.
    """
    return ml_service.check_model(symbol, timeframe)
