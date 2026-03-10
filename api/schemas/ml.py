"""
ML Schemas

Pydantic models for ML-related requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================

class MLTrainRequest(BaseModel):
    """
    ML model eğitimi isteği.
    
    Attributes:
        symbol: Sembol (örn: BTC/USDT)
        timeframe: Zaman dilimi (varsayılan: 1h)
        limit: Mum sayısı (varsayılan: 1000)
        model_type: Model tipi (varsayılan: xgboost)
    """
    symbol: str = Field(..., description="Sembol (örn: BTC/USDT)")
    timeframe: str = Field(default="1h", description="Zaman dilimi")
    limit: int = Field(default=1000, description="Mum sayısı", ge=100, le=10000)
    model_type: str = Field(default="xgboost", description="Model tipi")
    
    class Config:
        json_schema_extra = {
            "example": {
                "symbol": "BTC/USDT",
                "timeframe": "1h",
                "limit": 1000,
                "model_type": "xgboost"
            }
        }


class MLStatusRequest(BaseModel):
    """ML durum sorgulama isteği"""
    pass


class MLTrainingHistoryRequest(BaseModel):
    """ML eğitim geçmişi isteği"""
    limit: int = Field(default=50, description="Maksimum kayıt sayısı", ge=1, le=100)


class MLCheckModelRequest(BaseModel):
    """
    ML model kontrol isteği.
    
    Attributes:
        symbol: Sembol
        timeframe: Zaman dilimi
    """
    symbol: str = Field(..., description="Sembol")
    timeframe: str = Field(default="1h", description="Zaman dilimi")


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class MLTrainingState(BaseModel):
    """ML eğitim durumu"""
    is_training: bool
    progress: float
    message: str
    current_step: Optional[str] = None


class MLStatusResponse(BaseModel):
    """ML durum yanıtı"""
    status: str
    is_training: bool
    progress: float
    message: str
    current_step: Optional[str] = None


class MLTrainingHistoryItem(BaseModel):
    """ML eğitim geçmişi öğesi"""
    training_id: str
    symbol: str
    timeframe: str
    model_type: str
    dataset_size: int
    started_at: str
    completed_at: str
    duration_seconds: float
    metrics: Dict[str, float]
    model_path: str


class MLTrainingHistoryResponse(BaseModel):
    """ML eğitim geçmişi yanıtı"""
    status: str
    history: List[MLTrainingHistoryItem] = []
    total: int


class MLCheckModelResponse(BaseModel):
    """ML model kontrol yanıtı"""
    status: str
    model_exists: bool
    model_path: Optional[str] = None
    message: Optional[str] = None


class MLTrainResponse(BaseModel):
    """ML eğitim başlatma yanıtı"""
    status: str
    message: str
    model_path: Optional[str] = None


class MLErrorResponse(BaseModel):
    """ML hata yanıtı"""
    status: str = "error"
    message: str
