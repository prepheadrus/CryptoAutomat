"""
Config Schemas - Pydantic models for configuration
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum


class EnvironmentType(str, Enum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class LogLevelType(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


# ============================================================================
# RISK CONFIG SCHEMAS
# ============================================================================

class RiskConfigRequest(BaseModel):
    max_risk_per_trade_percent: float = Field(..., ge=0.1, le=5.0, description="İşlem başına maksimum risk (%)")
    max_leverage: int = Field(..., ge=1, le=50, description="Maksimum kaldıraç (1-50x)")
    max_open_positions: int = Field(..., ge=1, le=20, description="Maksimum açık pozisyon sayısı")
    max_consecutive_losses: int = Field(..., ge=0, le=50, description="Maksimum ardışık kayıp (0 = sınırsız)")
    kill_switch_enabled: bool = Field(default=True, description="Kill Switch aktif/pasif")


class RiskConfigResponse(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# ADVANCED CONFIG SCHEMAS
# ============================================================================

class WFOConfigRequest(BaseModel):
    enabled: bool = True
    train_days: int = Field(default=30, ge=7, le=90)
    test_days: int = Field(default=7, ge=1, le=30)
    reoptimize_interval: int = Field(default=168, ge=24, le=720)


class MLConfigRequest(BaseModel):
    enabled: bool = True
    confidence_threshold: float = Field(default=0.65, ge=0.50, le=0.95)


class HTFConfigRequest(BaseModel):
    enabled: bool = True
    trend_method: str = "ema_stack"


class AdvancedConfigRequest(BaseModel):
    wfo: Optional[WFOConfigRequest] = None
    ml: Optional[MLConfigRequest] = None
    htf: Optional[HTFConfigRequest] = None


class AdvancedConfigResponse(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# BOT CONFIG SCHEMAS
# ============================================================================

class BotConfigRequest(BaseModel):
    exchange: str = "binance"
    environment: EnvironmentType = EnvironmentType.DEVELOPMENT
    log_level: LogLevelType = LogLevelType.DEBUG


class BotConfigResponse(BaseModel):
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# API KEY SCHEMAS
# ============================================================================

class ApiKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=10)
    api_secret: str = Field(..., min_length=10)


class ApiKeyTestResponse(BaseModel):
    status: str
    message: Optional[str] = None
    valid: Optional[bool] = None


class ApiKeySaveResponse(BaseModel):
    status: str
    message: Optional[str] = None
    encrypted: Optional[bool] = None