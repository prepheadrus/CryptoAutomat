"""
System Router

FastAPI router for system operations.
Dashboard metrics, config, exchange info.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
from pathlib import Path
import os
import yaml

from core.logger import logger
from core.config import CONFIG
from core.paper import paper_engine
from core.exchange import exchange_manager
from api.schemas.config import (
    RiskConfigUpdate,
    AdvancedConfigUpdate,
    ApiKeyUpdateRequest,
    BotConfigUpdate,
)

router = APIRouter(prefix="/api/v1", tags=["System"])


# Global start time for uptime calculation
import time
START_TIME = time.time()


@router.get("/health", operation_id="get_health_status")
async def get_health_status() -> Dict[str, Any]:
    """
    Sistem sağlık durumunu döner.
    Monitoring araçları (Prometheus, Grafana, Uptime Kuma) için.
    """
    try:
        # Event Bus durumu
        from shared.events import event_bus
        event_bus_status = "running" if event_bus.running else "stopped"
        
        # Database durumu
        from data.database import db_manager
        db_status = "connected" if db_manager.sqlite_conn or db_manager.db_pool else "disconnected"
        
        # Exchange bağlantısı
        exchange_status = "connected" if exchange_manager.exchange else "disconnected"
        
        # Aktif botlar
        active_bots_count = len(paper_engine.active_bots) if hasattr(paper_engine, 'active_bots') else 0
        
        # Uptime hesaplama
        uptime_seconds = time.time() - START_TIME
        uptime_hours = uptime_seconds / 3600
        
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "components": {
                "event_bus": event_bus_status,
                "database": db_status,
                "exchange": exchange_status,
            },
            "metrics": {
                "active_bots": active_bots_count,
                "uptime_hours": round(uptime_hours, 2),
                "uptime_seconds": int(uptime_seconds)
            },
            "version": "4.0.0"
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "unhealthy",
            "timestamp": time.time(),
            "error": str(e),
            "version": "4.0.0"
        }


@router.get("/status", operation_id="get_system_status")
async def get_system_status() -> Dict[str, Any]:
    """
    Sistem durumunu döner.
    """
    return {
        "status": "online",
        "environment": CONFIG['bot'].get('environment', 'development'),
        "exchange": CONFIG['trading'].get('exchange', 'binance'),
        "tracking_symbols": CONFIG['trading'].get('symbols', [])
    }


@router.get("/dashboard-metrics")
async def get_dashboard_metrics() -> Dict[str, Any]:
    """
    Dashboard için tüm metrikleri döner.
    """
    try:
        # Paper engine'den stats al
        stats = paper_engine.get_stats()
        
        # Portfolio bilgisi
        portfolio = {
            "balance": stats.get('balance', 0.0),
            "free_margin": stats.get('free_margin', 0.0),
            "used_margin": stats.get('used_margin', 0.0),
            "equity": stats.get('equity', stats.get('balance', 0.0)),
            "unrealized_pnl": stats.get('unrealized_pnl', 0.0),
            "total_pnl": stats.get('total_pnl', 0.0),
            "total_trades": stats.get('total_trades', 0),
            "win_rate": stats.get('win_rate', 0.0),
            "total_commission": stats.get('total_commission', 0.0),
            "total_notional": stats.get('total_notional', 0.0),
        }
        
        # Aktif pozisyonlar
        positions = []
        for pos in paper_engine.open_positions:
            positions.append({
                "bot_id": pos.get('bot_id', 'N/A'),
                "symbol": pos.get('symbol', ''),
                "direction": pos.get('direction', ''),
                "entry_price": pos.get('entry_price', 0.0),
                "current_price": pos.get('current_price', 0.0),
                "size": pos.get('size', 0.0),
                "leverage": pos.get('leverage', 1.0),
                "margin": pos.get('margin', 0.0),
                "unrealized_usd": pos.get('unrealized_usd', 0.0),
                "pnl_percent": pos.get('pnl_percent', 0.0),
                "stop_loss": pos.get('stop_loss'),
                "take_profit": pos.get('take_profit'),
                "liquidation_price": pos.get('liquidation_price', 0.0),
                "strategy": pos.get('strategy', 'Unknown'),
                "strategy_id": pos.get('strategy_id', 'unknown'),
                "timeframe": pos.get('timeframe', 'N/A')
            })
        
        # Son kararlar (latest decisions)
        latest_decisions = paper_engine.latest_decisions
        
        # Market regime
        market_regime = paper_engine.market_regime

        return JSONResponse(
            content={
                "portfolio": portfolio,
                "positions": positions,
                "latest_decisions": latest_decisions,
                "market_regime": market_regime,
            },
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )

    except Exception as e:
        logger.error(f"Dashboard metrics error: {e}")
        return JSONResponse(
            content={
                "portfolio": {"balance": 0.0, "free_margin": 0.0, "used_margin": 0.0},
                "positions": [],
                "latest_decisions": {},
                "market_regime": "UNKNOWN"
            },
            status_code=500
        )


@router.get("/config/symbols")
async def get_tracked_symbols() -> Dict[str, Any]:
    """
    İzlenen sembollerin listesini döner.
    """
    return {"symbols": CONFIG['trading'].get('symbols', [])}


@router.get("/exchange/markets")
async def get_exchange_markets() -> Dict[str, Any]:
    """
    Borsadaki tüm aktif USDT işlem çiftlerini döner.
    """
    try:
        markets = await exchange_manager.fetch_available_markets()
        return {"markets": markets}
    except Exception as e:
        logger.error(f"Exchange markets error: {e}")
        return {"markets": []}


# ============================================================================
# CONFIG ENDPOINTS (Hot-Reload & Persistence)
# ============================================================================

@router.get("/config/bot")
async def get_bot_config() -> Dict[str, Any]:
    """Genel bot ayarlarını döner."""
    return {
        "status": "success",
        "config": CONFIG.get('bot', {})
    }

@router.post("/config/bot")
async def update_bot_config(request: BotConfigUpdate) -> Dict[str, Any]:
    """Genel bot ayarlarını günceller."""
    try:
        # Update memory
        CONFIG['bot']['environment'] = request.environment
        CONFIG['bot']['exchange'] = request.exchange
        CONFIG['bot']['log_level'] = request.log_level
        
        # Persist to yaml
        config_path = "config.yaml"
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                full_config = yaml.safe_load(f)

            if 'bot' not in full_config: full_config['bot'] = {}
            full_config['bot']['environment'] = request.environment
            full_config['bot']['exchange'] = request.exchange
            full_config['bot']['log_level'] = request.log_level
            
            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(full_config, f, default_flow_style=False, allow_unicode=True)

        return {"status": "success", "message": "Bot ayarları güncellendi", "config": CONFIG['bot']}
    except Exception as e:
        logger.error(f"Bot config update error: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/config/risk")
async def get_risk_config() -> Dict[str, Any]:
    """Mevcut risk ayarlarını döner."""
    return {
        "status": "success",
        "config": CONFIG.get('risk_management', {})
    }


@router.post("/config/risk")
async def update_risk_config(request: RiskConfigUpdate) -> Dict[str, Any]:
    """Risk ayarlarını günceller."""
    try:
        # 1. Memory update
        CONFIG['risk_management']['max_risk_per_trade_percent'] = request.max_risk_per_trade_percent
        CONFIG['risk_management']['max_leverage'] = request.max_leverage
        CONFIG['risk_management']['max_open_positions'] = request.max_open_positions
        CONFIG['risk_management']['max_consecutive_losses'] = request.max_consecutive_losses
        CONFIG['risk_management']['kill_switch'] = CONFIG.get('kill_switch', {})
        CONFIG['risk_management']['kill_switch']['enabled'] = request.kill_switch_enabled

        # 2. YAML persistence
        config_path = "config.yaml"
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                full_config = yaml.safe_load(f)

            if 'risk_management' not in full_config: full_config['risk_management'] = {}
            full_config['risk_management'].update({
                'max_risk_per_trade_percent': request.max_risk_per_trade_percent,
                'max_leverage': request.max_leverage,
                'max_open_positions': request.max_open_positions,
                'max_consecutive_losses': request.max_consecutive_losses,
                'kill_switch': {
                    'enabled': request.kill_switch_enabled,
                    'max_consecutive_losses': request.max_consecutive_losses
                }
            })

            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(full_config, f, default_flow_style=False, allow_unicode=True)

        # 3. Paper engine hot-reload
        if hasattr(paper_engine, 'risk_engine'):
            paper_engine.risk_engine.config.max_risk_per_trade = request.max_risk_per_trade_percent / 100.0
            paper_engine.risk_engine.config.max_leverage = request.max_leverage
            paper_engine.risk_engine.config.max_open_positions = request.max_open_positions
            paper_engine.risk_engine.config.max_consecutive_losses = request.max_consecutive_losses
            
            # Kill switch hot-reload
            if request.kill_switch_enabled:
                paper_engine.risk_engine.kill_switch_active = False  # Reset on config change
                paper_engine.risk_engine.consecutive_losses = 0
            paper_engine.risk_engine.config.kill_switch_enabled = request.kill_switch_enabled

        return {
            "status": "success", 
            "message": "Risk ayarları güncellendi", 
            "config": CONFIG['risk_management']
        }
    except Exception as e:
        logger.error(f"Risk config update error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/config/advanced")
async def get_advanced_config() -> Dict[str, Any]:
    """Gelişmiş ayarları çek."""
    return {
        "status": "success",
        "config": {
            "wfo": CONFIG.get('wfo', {}),
            "ml": CONFIG.get('ml', {}),
            "htf": CONFIG.get('htf', {}),
            "kalman": CONFIG.get('kalman', {'enabled': True, 'q': 0.001, 'r': 0.1}),
            "candle_lock": CONFIG.get('candle_lock', {'enabled': True, 'interval': 1})
        }
    }


@router.post("/config/advanced")
async def update_advanced_config(request: AdvancedConfigUpdate) -> Dict[str, Any]:
    """Gelişmiş ayarları güncelle."""
    try:
        config_path = "config.yaml"
        full_config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                full_config = yaml.safe_load(f)

        if request.wfo:
            CONFIG['wfo'] = request.wfo.dict()
            full_config['wfo'] = request.wfo.dict()
        if request.ml:
            CONFIG['ml'] = request.ml.dict()
            full_config['ml'] = request.ml.dict()
            paper_engine.ml_enabled = CONFIG['ml'].get('enabled', True)
        if request.htf:
            CONFIG['htf'] = request.htf.dict()
            full_config['htf'] = request.htf.dict()
        if request.kalman:
            CONFIG['kalman'] = request.kalman.dict()
            full_config['kalman'] = request.kalman.dict()
        if request.candle_lock:
            CONFIG['candle_lock'] = request.candle_lock.dict()
            full_config['candle_lock'] = request.candle_lock.dict()

        if os.path.exists(config_path):
            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(full_config, f, default_flow_style=False, allow_unicode=True)

        return {"status": "success", "message": "Gelişmiş ayarlar güncellendi", "config": CONFIG}
    except Exception as e:
        logger.error(f"Advanced config update error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# API KEY ENDPOINTS
# ============================================================================

@router.post("/config/api-keys")
async def save_api_keys(request: ApiKeyUpdateRequest) -> Dict[str, Any]:
    """API anahtarlarını şifreleyerek kaydet."""
    try:
        from core.security import KeyManager
        key_manager = KeyManager()
        key_manager.save_api_keys(request.api_key, request.api_secret)
        return {"status": "success", "message": "API anahtarları şifrelenerek kaydedildi"}
    except Exception as e:
        logger.error(f"API key save error: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/config/test-api-keys")
async def test_api_keys(request: ApiKeyUpdateRequest) -> Dict[str, Any]:
    """API anahtarlarını CCXT ile test et."""
    try:
        import ccxt.async_support as ccxt
        exchange = ccxt.binance({
            'apiKey': request.api_key,
            'secret': request.api_secret,
            'enableRateLimit': True,
            'options': {'defaultType': 'future'}
        })
        balance = await exchange.fetch_balance()
        await exchange.close()
        usdt_balance = balance.get('total', {}).get('USDT', 0)
        return {
            "status": "success",
            "message": "API anahtarları geçerli!",
            "valid": True,
            "usdt_balance": usdt_balance
        }
    except Exception as e:
        logger.error(f"API keys test error: {e}")
        return {"status": "error", "message": str(e), "valid": False}
