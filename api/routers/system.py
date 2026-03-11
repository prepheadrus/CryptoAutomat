"""
System Router

FastAPI router for system operations.
Dashboard metrics, config, exchange info.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pathlib import Path

from core.logger import logger
from core.config import CONFIG
from core.paper import paper_engine
from core.exchange import exchange_manager
from api.schemas.config import (
    RiskConfigRequest,
    RiskConfigResponse,
    AdvancedConfigRequest,
    AdvancedConfigResponse,
    BotConfigRequest,
    BotConfigResponse,
    ApiKeyRequest,
    ApiKeyTestResponse,
    ApiKeySaveResponse,
)

router = APIRouter(prefix="/api/v1", tags=["System"])


@router.get("/status")
async def get_system_status() -> Dict[str, Any]:
    """
    Sistem durumunu döner.
    """
    return {
        "status": "online",
        "environment": CONFIG['bot']['environment'],
        "exchange": CONFIG['trading']['exchange'],
        "tracking_symbols": CONFIG['trading']['symbols']
    }


@router.get("/dashboard-metrics")
async def get_dashboard_metrics() -> Dict[str, Any]:
    """
    Dashboard için tüm metrikleri döner.
    
    Returns:
        {
            portfolio: {balance, free_margin, used_margin, total_pnl, ...},
            positions: [...],
            latest_decisions: {...},
            market_regime: str
        }
    """
    try:
        # Paper engine'den stats al
        stats = paper_engine.get_stats()
        
        # Portfolio bilgisi
        portfolio = {
            "balance": stats.get('balance', 0.0),
            "free_margin": stats.get('free_margin', 0.0),
            "used_margin": stats.get('used_margin', 0.0),
            "total_pnl": stats.get('total_pnl', 0.0),
            "total_trades": stats.get('total_trades', 0),
            "win_rate": stats.get('win_rate', 0.0),
        }
        
        # Aktif pozisyonlar
        positions = []
        for pos in paper_engine.open_positions:
            positions.append({
                "symbol": pos.get('symbol', ''),
                "direction": pos.get('direction', ''),
                "entry_price": pos.get('entry_price', 0.0),
                "current_price": pos.get('current_price', 0.0),
                "size": pos.get('size', 0.0),
                "leverage": pos.get('leverage', 1.0),
                "unrealized_usd": pos.get('unrealized_usd', 0.0),
                "pnl_percent": pos.get('pnl_percent', 0.0),
                "stop_loss": pos.get('stop_loss'),
                "take_profit": pos.get('take_profit'),
            })
        
        # Son kararlar (latest decisions)
        latest_decisions = paper_engine.latest_decisions
        
        # Market regime
        market_regime = paper_engine.market_regime
        
        return {
            "portfolio": portfolio,
            "positions": positions,
            "latest_decisions": latest_decisions,
            "market_regime": market_regime,
        }
        
    except Exception as e:
        logger.error(f"Dashboard metrics error: {e}")
        return {
            "portfolio": {"balance": 0.0, "free_margin": 0.0, "used_margin": 0.0},
            "positions": [],
            "latest_decisions": {},
            "market_regime": "UNKNOWN"
        }


@router.get("/config/symbols")
async def get_tracked_symbols() -> Dict[str, Any]:
    """
    İzlenen sembollerin listesini döner.
    """
    return {"symbols": CONFIG['trading']['symbols']}


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
# COMPATIBILITY ENDPOINTS (Frontend uyumluluğu için)
# ============================================================================

@router.get("/bots/list")
async def get_bots_list_compat() -> Dict[str, Any]:
    """
    COMPATIBILITY: /api/v1/bots/list endpoint'i
    Frontend'in çoğul form isteği için alias.
    """
    from core.paper import paper_engine

    try:
        bots = []
        for bot_id, bot_info in paper_engine.active_bots.items():
            bots.append({
                'bot_id': bot_id,
                'symbol': bot_info.get('symbol', ''),
                'strategy_id': bot_info.get('strategy_id', ''),
                'timeframe': bot_info.get('timeframe', '1m'),
                'market_type': bot_info.get('market_type', 'swap'),
                'status': bot_info.get('status', 'running'),
                'pnl': bot_info.get('pnl', 0.0),
                'margin': bot_info.get('margin', 0.0),
            })

        return {"status": "success", "bots": bots}
    except Exception as e:
        logger.error(f"Bots list error: {e}")
        return {"status": "error", "bots": [], "message": str(e)}


# ============================================================================
# API KEY & CONFIG ENDPOINTS (ENCRYPTED)
# ============================================================================

@router.post("/config/api-keys")
async def save_api_keys(request: dict) -> Dict[str, Any]:
    """
    API anahtarlarını şifreleyerek .env dosyasına kaydet.
    
    Request Body:
        api_key: str
        api_secret: str
    
    Returns:
        status: success/error
        message: İşlem sonucu
    """
    try:
        from core.security import encrypt_api_key
        
        api_key = request.get('api_key', '')
        api_secret = request.get('api_secret', '')
        
        logger.info(f"🔐 API anahtarları şifreleniyor...")
        
        # Validasyon
        if len(api_key) < 10 or len(api_secret) < 10:
            raise ValueError("API key/secret çok kısa (min 10 karakter)")
        
        # Şifrele
        encrypted_key = encrypt_api_key(api_key)
        encrypted_secret = encrypt_api_key(api_secret)
        
        logger.info(f"✅ API Key şifrelendi: {encrypted_key[:20]}...")
        logger.info(f"✅ API Secret şifrelendi: {encrypted_secret[:20]}...")
        
        # .env dosyasına yaz
        env_file = Path(".env")
        env_lines = []
        old_key_found = False
        old_secret_found = False
        
        if env_file.exists():
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.startswith('BINANCE_API_KEY='):
                        env_lines.append(f'BINANCE_API_KEY={encrypted_key}\n')
                        old_key_found = True
                        logger.info(f"🔄 Eski API Key güncellendi")
                    elif line.startswith('BINANCE_API_SECRET='):
                        env_lines.append(f'BINANCE_API_SECRET={encrypted_secret}\n')
                        old_secret_found = True
                        logger.info(f"🔄 Eski API Secret güncellendi")
                    else:
                        env_lines.append(line)
        
        # Eğer eski key/secret yoksa, ekle
        if not old_key_found:
            env_lines.append(f'BINANCE_API_KEY={encrypted_key}\n')
            logger.info(f"➕ Yeni API Key eklendi")
        
        if not old_secret_found:
            env_lines.append(f'BINANCE_API_SECRET={encrypted_secret}\n')
            logger.info(f"➕ Yeni API Secret eklendi")
        
        # .env dosyasına yaz
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(env_lines)
        
        logger.info(f"✅ .env dosyası güncellendi: {env_file}")
        
        return {
            "status": "success",
            "message": "API anahtarları şifrelenerek kaydedildi",
            "encrypted": True
        }
    
    except Exception as e:
        logger.error(f"❌ API key kaydetme hatası: {e}")
        return {"status": "error", "message": f"API key kaydetme hatası: {str(e)}"}


@router.post("/config/test-api-keys")
async def test_api_keys(request: dict) -> Dict[str, Any]:
    """
    API anahtarlarını test et (Binance'e bağlan).
    
    Request Body:
        api_key: str
        api_secret: str
    
    Returns:
        status: success/error
        message: Test sonucu
        valid: True/False
    """
    try:
        import ccxt
        import asyncio
        
        api_key = request.get('api_key', '')
        api_secret = request.get('api_secret', '')
        
        logger.info(f"🧪 API anahtarları test ediliyor...")
        
        # Exchange oluştur
        exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'enableRateLimit': True,
        })
        
        # Test: Bakiye sorgula
        try:
            # Sync call (async context'te)
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, exchange.fetch_balance)
            
            logger.info(f"✅ API anahtarları geçerli!")
            return {
                "status": "success",
                "message": "API anahtarları geçerli - Binance'e bağlanıldı",
                "valid": True
            }
        except Exception as e:
            logger.warning(f"⚠️ API anahtarları geçersiz: {e}")
            return {
                "status": "error",
                "message": f"API anahtarları geçersiz: {str(e)}",
                "valid": False
            }
        finally:
            await exchange.close()

    except Exception as e:
        logger.error(f"❌ API test hatası: {e}")
        return {
            "status": "error",
            "message": f"Test hatası: {str(e)}",
            "valid": False
        }


# ============================================================================
# RISK CONFIG ENDPOINTS
# ============================================================================

@router.get("/config/risk")
async def get_risk_config() -> Dict[str, Any]:
    """
    Mevcut risk ayarlarını döner.
    
    Returns:
        max_risk_per_trade_percent: float
        max_leverage: int
        max_open_positions: int
        max_consecutive_losses: int
    """
    try:
        from core.config import CONFIG
        
        risk_config = CONFIG.get('risk_management', {})
        
        return {
            "status": "success",
            "data": {
                "max_risk_per_trade_percent": risk_config.get('max_risk_per_trade_percent', 0.2),
                "max_leverage": risk_config.get('max_leverage', 10),
                "max_open_positions": risk_config.get('max_open_positions', 5),
                "max_consecutive_losses": risk_config.get('max_consecutive_losses', 5)
            }
        }
    except Exception as e:
        logger.error(f"❌ Risk config okuma hatası: {e}")
        return {
            "status": "error",
            "message": f"Risk config okuma hatası: {str(e)}",
            "data": {}
        }


@router.post("/config/risk")
async def update_risk_config(request: dict) -> Dict[str, Any]:
    """
    Risk ayarlarını günceller.
    
    Request Body:
        max_risk_per_trade_percent: float (0.1 - 5.0)
        max_leverage: int (1 - 50)
        max_open_positions: int (1 - 20)
        max_consecutive_losses: int (1 - 10)
    
    Returns:
        status: success/error
        message: İşlem sonucu
        data: Güncellenen ayarlar
    """
    try:
        import yaml
        from core.config import CONFIG
        
        # Request verilerini al
        max_risk = float(request.get('max_risk_per_trade_percent', 0.2))
        max_leverage = int(request.get('max_leverage', 10))
        max_positions = int(request.get('max_open_positions', 5))
        max_losses = int(request.get('max_consecutive_losses', 5))
        
        # Frontend validasyonu (ekstra güvenlik)
        if max_risk < 0.1 or max_risk > 5.0:
            raise ValueError(f"Risk %0.1 ile %5.0 arasında olmalı (girdiğiniz: %{max_risk})")
        
        if max_leverage < 1 or max_leverage > 50:
            raise ValueError(f"Kaldıraç 1x ile 50x arasında olmalı (girdiğiniz: {max_leverage}x)")
        
        if max_positions < 1 or max_positions > 20:
            raise ValueError(f"Pozisyon 1 ile 20 arasında olmalı (girdiğiniz: {max_positions})")
        
        if max_losses < 1 or max_losses > 10:
            raise ValueError(f"Ardışık kayıp 1 ile 10 arasında olmalı (girdiğiniz: {max_losses})")
        
        logger.info(f"📊 Risk ayarları güncelleniyor...")
        logger.info(f"   - Max Risk: %{max_risk}")
        logger.info(f"   - Max Leverage: {max_leverage}x")
        logger.info(f"   - Max Positions: {max_positions}")
        logger.info(f"   - Max Consecutive Losses: {max_losses}")
        
        # config.yaml'ı yükle
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Risk ayarlarını güncelle
        config['risk_management']['max_risk_per_trade_percent'] = max_risk
        config['risk_management']['max_leverage'] = max_leverage
        config['risk_management']['max_open_positions'] = max_positions
        config['risk_management']['max_consecutive_losses'] = max_losses
        
        # config.yaml'a yaz (güvenli dump)
        with open('config.yaml', 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"✅ config.yaml güncellendi")
        
        # RAM'deki CONFIG'i güncelle (hot-reload)
        CONFIG['risk_management']['max_risk_per_trade_percent'] = max_risk
        CONFIG['risk_management']['max_leverage'] = max_leverage
        CONFIG['risk_management']['max_open_positions'] = max_positions
        CONFIG['risk_management']['max_consecutive_losses'] = max_losses
        
        logger.info(f"✅ RAM'deki CONFIG güncellendi (hot-reload)")
        
        # RiskEngine'i re-initialize et (yeni ayarlarla)
        from core.paper import paper_engine
        if hasattr(paper_engine, 'risk_engine'):
            paper_engine.risk_engine.config.max_risk_per_trade = max_risk / 100.0
            paper_engine.risk_engine.config.max_leverage = max_leverage
            logger.info(f"✅ RiskEngine re-initialize edildi")
        
        return {
            "status": "success",
            "message": "Risk ayarları güncellendi",
            "data": {
                "max_risk_per_trade_percent": max_risk,
                "max_leverage": max_leverage,
                "max_open_positions": max_positions,
                "max_consecutive_losses": max_losses
            }
        }
    
    except ValueError as ve:
        logger.error(f"❌ Validasyon hatası: {ve}")
        return {
            "status": "error",
            "message": str(ve),
            "data": {}
        }
    except Exception as e:
        logger.error(f"❌ Risk config güncelleme hatası: {e}")
        return {
            "status": "error",
            "message": f"Risk config güncelleme hatası: {str(e)}",
            "data": {}
        }


# ============================================================================
# ADVANCED CONFIG ENDPOINTS (WFO, ML, HTF)
# ============================================================================

@router.get("/config/advanced")
async def get_advanced_config() -> Dict[str, Any]:
    """
    Gelişmiş ayarları döner (WFO, ML, HTF).
    
    Returns:
        wfo: WFO ayarları
        ml: ML ayarları
        htf: HTF ayarları
    """
    try:
        from core.config import CONFIG
        
        return {
            "status": "success",
            "data": {
                "wfo": CONFIG.get('wfo', {}),
                "ml": CONFIG.get('ml', {}),
                "htf": CONFIG.get('htf', {})
            }
        }
    except Exception as e:
        logger.error(f"❌ Advanced config okuma hatası: {e}")
        return {
            "status": "error",
            "message": f"Advanced config okuma hatası: {str(e)}",
            "data": {}
        }


@router.post("/config/advanced")
async def update_advanced_config(request: dict) -> Dict[str, Any]:
    """
    Gelişmiş ayarları günceller (WFO, ML, HTF).
    
    Request Body:
        wfo: {enabled, train_days, test_days, reoptimize_interval}
        ml: {enabled, confidence_threshold}
        htf: {enabled, trend_method}
    
    Returns:
        status: success/error
        message: İşlem sonucu
        data: Güncellenen ayarlar
    """
    try:
        import yaml
        from core.config import CONFIG
        
        logger.info(f"🔧 Gelişmiş ayarlar güncelleniyor...")
        
        # config.yaml'ı yükle
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # WFO ayarları
        if 'wfo' in request:
            wfo = request['wfo']
            config['wfo']['enabled'] = bool(wfo.get('enabled', True))
            config['wfo']['train_days'] = int(wfo.get('train_days', 30))
            config['wfo']['test_days'] = int(wfo.get('test_days', 7))
            config['wfo']['reoptimize_interval'] = int(wfo.get('reoptimize_interval', 168))
            logger.info(f"✅ WFO güncellendi: enabled={config['wfo']['enabled']}")
        
        # ML ayarları
        if 'ml' in request:
            ml = request['ml']
            config['ml']['enabled'] = bool(ml.get('enabled', True))
            config['ml']['confidence_threshold'] = float(ml.get('confidence_threshold', 0.65))
            logger.info(f"✅ ML güncellendi: enabled={config['ml']['enabled']}, threshold={config['ml']['confidence_threshold']}")
        
        # HTF ayarları
        if 'htf' in request:
            htf = request['htf']
            config['htf']['enabled'] = bool(htf.get('enabled', True))
            config['htf']['trend_method'] = str(htf.get('trend_method', 'ema_stack'))
            logger.info(f"✅ HTF güncellendi: enabled={config['htf']['enabled']}")
        
        # config.yaml'a yaz
        with open('config.yaml', 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"✅ config.yaml güncellendi")
        
        # RAM'deki CONFIG'i güncelle (hot-reload)
        if 'wfo' in request:
            CONFIG['wfo'].update(config['wfo'])
        if 'ml' in request:
            CONFIG['ml'].update(config['ml'])
        if 'htf' in request:
            CONFIG['htf'].update(config['htf'])
        
        logger.info(f"✅ RAM'deki CONFIG güncellendi (hot-reload)")
        
        return {
            "status": "success",
            "message": "Gelişmiş ayarlar güncellendi",
            "data": {
                "wfo": config.get('wfo', {}),
                "ml": config.get('ml', {}),
                "htf": config.get('htf', {})
            }
        }

    except Exception as e:
        logger.error(f"❌ Advanced config güncelleme hatası: {e}")
        return {
            "status": "error",
            "message": f"Advanced config güncelleme hatası: {str(e)}",
            "data": {}
        }


# ============================================================================
# BOT CONFIG ENDPOINTS
# ============================================================================

@router.get("/config/bot")
async def get_bot_config() -> BotConfigResponse:
    """
    Bot yapılandırmasını döner.
    
    Returns:
        exchange: Borsa adı
        environment: Ortam (development/production)
        log_level: Log seviyesi
    """
    try:
        from core.config import CONFIG
        
        bot_config = CONFIG.get('bot', {})
        
        return BotConfigResponse(
            status="success",
            message="Bot config okundu",
            data={
                "exchange": bot_config.get('exchange', 'binance'),
                "environment": bot_config.get('environment', 'development'),
                "log_level": bot_config.get('log_level', 'DEBUG')
            }
        )
    except Exception as e:
        logger.error(f"❌ Bot config okuma hatası: {e}")
        return BotConfigResponse(
            status="error",
            message=f"Bot config okuma hatası: {str(e)}",
            data={}
        )


@router.post("/config/bot", response_model=BotConfigResponse)
async def update_bot_config(request: BotConfigRequest) -> BotConfigResponse:
    """
    Bot yapılandırmasını günceller.
    
    Request Body:
        exchange: Borsa adı (binance, binance_spot)
        environment: Ortam (development, production)
        log_level: Log seviyesi (DEBUG, INFO, WARNING, ERROR)
    
    Returns:
        status: success/error
        message: İşlem sonucu
        data: Güncellenen ayarlar
    """
    try:
        import yaml
        from core.config import CONFIG
        
        logger.info(f"🤖 Bot yapılandırması güncelleniyor...")
        logger.info(f"   - Exchange: {request.exchange}")
        logger.info(f"   - Environment: {request.environment}")
        logger.info(f"   - Log Level: {request.log_level}")
        
        # config.yaml'ı yükle
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Bot ayarlarını güncelle
        config['bot']['exchange'] = request.exchange
        config['bot']['environment'] = request.environment.value
        config['bot']['log_level'] = request.log_level.value
        
        # config.yaml'a yaz
        with open('config.yaml', 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"✅ config.yaml güncellendi")
        
        # RAM'deki CONFIG'i güncelle (hot-reload)
        CONFIG['bot']['exchange'] = request.exchange
        CONFIG['bot']['environment'] = request.environment.value
        CONFIG['bot']['log_level'] = request.log_level.value
        
        logger.info(f"✅ RAM'deki CONFIG güncellendi (hot-reload)")
        
        return BotConfigResponse(
            status="success",
            message="Bot yapılandırması güncellendi",
            data={
                "exchange": request.exchange,
                "environment": request.environment.value,
                "log_level": request.log_level.value
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Bot config güncelleme hatası: {e}")
        return BotConfigResponse(
            status="error",
            message=f"Bot config güncelleme hatası: {str(e)}",
            data={}
        )
