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
    RiskConfigUpdate,
    AdvancedConfigUpdate,
    ApiKeyUpdateRequest,
)

router = APIRouter(prefix="/api/v1", tags=["System"])


@router.get("/status", operation_id="get_system_status")
async def get_system_status() -> Dict[str, Any]:
    """
    Sistem durumunu dÃ¶ner.
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
    Dashboard iÃ§in tÃ¼m metrikleri dÃ¶ner.

    Returns:
        {
            portfolio: {balance, free_margin, used_margin, total_pnl, ...},
            positions: [...],
            latest_decisions: {...},
            market_regime: str
        }
    """
    from fastapi.responses import JSONResponse
    
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
                "timeframe": pos.get('timeframe', 'N/A')  # YENÄ°: Timeframe ekle
            })
        
        # Son kararlar (latest decisions)
        latest_decisions = paper_engine.latest_decisions
        
        # Market regime
        market_regime = paper_engine.market_regime

        # No-cache headers ile response dÃ¶ndÃ¼r (real-time veri iÃ§in)
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
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )


@router.get("/config/symbols")
async def get_tracked_symbols() -> Dict[str, Any]:
    """
    Ä°zlenen sembollerin listesini dÃ¶ner.
    """
    return {"symbols": CONFIG['trading']['symbols']}


@router.get("/exchange/markets")
async def get_exchange_markets() -> Dict[str, Any]:
    """
    Borsadaki tÃ¼m aktif USDT iÅŸlem Ã§iftlerini dÃ¶ner.
    """
    try:
        markets = await exchange_manager.fetch_available_markets()
        return {"markets": markets}
    except Exception as e:
        logger.error(f"Exchange markets error: {e}")
        return {"markets": []}


# ============================================================================
# COMPATIBILITY ENDPOINTS (Frontend uyumluluÄŸu iÃ§in)
# ============================================================================

@router.get("/bots/list")
async def get_bots_list_compat() -> Dict[str, Any]:
    """
    COMPATIBILITY: /api/v1/bots/list endpoint'i
    Frontend'in Ã§oÄŸul form isteÄŸi iÃ§in alias.
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
    API anahtarlarÄ±nÄ± ÅŸifreleyerek .env dosyasÄ±na kaydet.
    
    Request Body:
        api_key: str
        api_secret: str
    
    Returns:
        status: success/error
        message: Ä°ÅŸlem sonucu
    """
    try:
        from core.security import encrypt_api_key
        
        api_key = request.get('api_key', '')
        api_secret = request.get('api_secret', '')
        
        logger.info(f"ğŸ” API anahtarlarÄ± ÅŸifreleniyor...")
        
        # Validasyon
        if len(api_key) < 10 or len(api_secret) < 10:
            raise ValueError("API key/secret Ã§ok kÄ±sa (min 10 karakter)")
        
        # Åifrele
        encrypted_key = encrypt_api_key(api_key)
        encrypted_secret = encrypt_api_key(api_secret)
        
        logger.info(f"âœ… API Key ÅŸifrelendi: {encrypted_key[:20]}...")
        logger.info(f"âœ… API Secret ÅŸifrelendi: {encrypted_secret[:20]}...")
        
        # .env dosyasÄ±na yaz
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
                        logger.info(f"ğŸ”„ Eski API Key gÃ¼ncellendi")
                    elif line.startswith('BINANCE_API_SECRET='):
                        env_lines.append(f'BINANCE_API_SECRET={encrypted_secret}\n')
                        old_secret_found = True
                        logger.info(f"ğŸ”„ Eski API Secret gÃ¼ncellendi")
                    else:
                        env_lines.append(line)
        
        # EÄŸer eski key/secret yoksa, ekle
        if not old_key_found:
            env_lines.append(f'BINANCE_API_KEY={encrypted_key}\n')
            logger.info(f"â• Yeni API Key eklendi")
        
        if not old_secret_found:
            env_lines.append(f'BINANCE_API_SECRET={encrypted_secret}\n')
            logger.info(f"â• Yeni API Secret eklendi")
        
        # .env dosyasÄ±na yaz
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(env_lines)
        
        logger.info(f"âœ… .env dosyasÄ± gÃ¼ncellendi: {env_file}")
        
        return {
            "status": "success",
            "message": "API anahtarlarÄ± ÅŸifrelenerek kaydedildi",
            "encrypted": True
        }
    
    except Exception as e:
        logger.error(f"âŒ API key kaydetme hatasÄ±: {e}")
        return {"status": "error", "message": f"API key kaydetme hatasÄ±: {str(e)}"}


@router.post("/config/test-api-keys")
async def test_api_keys(request: dict) -> Dict[str, Any]:
    """
    API anahtarlarÄ±nÄ± test et (Binance'e baÄŸlan).
    
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
        
        logger.info(f"ğŸ§ª API anahtarlarÄ± test ediliyor...")
        
        # Exchange oluÅŸtur
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
            
            logger.info(f"âœ… API anahtarlarÄ± geÃ§erli!")
            return {
                "status": "success",
                "message": "API anahtarlarÄ± geÃ§erli - Binance'e baÄŸlanÄ±ldÄ±",
                "valid": True
            }
        except Exception as e:
            logger.warning(f"âš ï¸ API anahtarlarÄ± geÃ§ersiz: {e}")
            return {
                "status": "error",
                "message": f"API anahtarlarÄ± geÃ§ersiz: {str(e)}",
                "valid": False
            }
        finally:
            await exchange.close()

    except Exception as e:
        logger.error(f"âŒ API test hatasÄ±: {e}")
        return {
            "status": "error",
            "message": f"Test hatasÄ±: {str(e)}",
            "valid": False
        }


# ============================================================================
# RISK CONFIG ENDPOINTS
# ============================================================================

@router.get("/config/risk")
async def get_risk_config() -> Dict[str, Any]:
    """
    Mevcut risk ayarlarÄ±nÄ± dÃ¶ner.

    Returns:
        max_risk_per_trade_percent: float
        max_leverage: int
        max_open_positions: int
        max_consecutive_losses: int
        kill_switch_enabled: bool
    """
    try:
        from core.config import CONFIG

        risk_config = CONFIG.get('risk_management', {})
        kill_switch_config = risk_config.get('kill_switch', {})

        return {
            "status": "success",
            "data": {
                "max_risk_per_trade_percent": risk_config.get('max_risk_per_trade_percent', 0.2),
                "max_leverage": risk_config.get('max_leverage', 10),
                "max_open_positions": risk_config.get('max_open_positions', 5),
                "max_consecutive_losses": risk_config.get('max_consecutive_losses', 10),
                "kill_switch_enabled": kill_switch_config.get('enabled', True)
            }
        }
    except Exception as e:
        logger.error(f"âŒ Risk config okuma hatasÄ±: {e}")
        return {
            "status": "error",
            "message": f"Risk config okuma hatasÄ±: {str(e)}",
            "data": {}
        }


@router.post("/config/risk")
async def update_risk_config(request: dict) -> Dict[str, Any]:
    """
    Risk ayarlarÄ±nÄ± gÃ¼nceller.

    Request Body:
        max_risk_per_trade_percent: float (0.1 - 5.0)
        max_leverage: int (1 - 50)
        max_open_positions: int (1 - 20)
        max_consecutive_losses: int (0 - 50, 0 = sÄ±nÄ±rsÄ±z)
        kill_switch_enabled: bool

    Returns:
        status: success/error
        message: Ä°ÅŸlem sonucu
        data: GÃ¼ncellenen ayarlar
    """
    try:
        import yaml
        from core.config import CONFIG

        # Request verilerini al
        max_risk = float(request.get('max_risk_per_trade_percent', 0.2))
        max_leverage = int(request.get('max_leverage', 10))
        max_positions = int(request.get('max_open_positions', 5))
        max_losses = int(request.get('max_consecutive_losses', 10))
        kill_switch_enabled = request.get('kill_switch_enabled', True)

        # Frontend validasyonu (ekstra gÃ¼venlik)
        if max_risk < 0.1 or max_risk > 5.0:
            raise ValueError(f"Risk %0.1 ile %5.0 arasÄ±nda olmalÄ± (girdiÄŸiniz: %{max_risk})")

        if max_leverage < 1 or max_leverage > 50:
            raise ValueError(f"KaldÄ±raÃ§ 1x ile 50x arasÄ±nda olmalÄ± (girdiÄŸiniz: {max_leverage}x)")

        if max_positions < 1 or max_positions > 20:
            raise ValueError(f"Pozisyon 1 ile 20 arasÄ±nda olmalÄ± (girdiÄŸiniz: {max_positions})")

        if max_losses < 0 or max_losses > 50:
            raise ValueError(f"ArdÄ±ÅŸÄ±k kayÄ±p 0 ile 50 arasÄ±nda olmalÄ± (girdiÄŸiniz: {max_losses}, 0 = sÄ±nÄ±rsÄ±z)")

        logger.info(f"ğŸ“Š Risk ayarlarÄ± gÃ¼ncelleniyor...")
        logger.info(f"   - Max Risk: %{max_risk}")
        logger.info(f"   - Max Leverage: {max_leverage}x")
        logger.info(f"   - Max Positions: {max_positions}")
        logger.info(f"   - Max Consecutive Losses: {max_losses} {'(sÄ±nÄ±rsÄ±z)' if max_losses == 0 else ''}")
        logger.info(f"   - Kill Switch Enabled: {kill_switch_enabled}")

        # config.yaml'Ä± yÃ¼kle
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)

        # Risk ayarlarÄ±nÄ± gÃ¼ncelle
        config['risk_management']['max_risk_per_trade_percent'] = max_risk
        config['risk_management']['max_leverage'] = max_leverage
        config['risk_management']['max_open_positions'] = max_positions
        config['risk_management']['max_consecutive_losses'] = max_losses

        # Kill Switch nested config
        if 'kill_switch' not in config['risk_management']:
            config['risk_management']['kill_switch'] = {}
        config['risk_management']['kill_switch']['enabled'] = kill_switch_enabled
        config['risk_management']['kill_switch']['max_consecutive_losses'] = max_losses

        # config.yaml'a yaz (gÃ¼venli dump)
        with open('config.yaml', 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, default_flow_style=False, allow_unicode=True)

        logger.info(f"âœ… config.yaml gÃ¼ncellendi")

        # RAM'deki CONFIG'i gÃ¼ncelle (hot-reload)
        CONFIG['risk_management']['max_risk_per_trade_percent'] = max_risk
        CONFIG['risk_management']['max_leverage'] = max_leverage
        CONFIG['risk_management']['max_open_positions'] = max_positions
        CONFIG['risk_management']['max_consecutive_losses'] = max_losses
        if 'kill_switch' not in CONFIG['risk_management']:
            CONFIG['risk_management']['kill_switch'] = {}
        CONFIG['risk_management']['kill_switch']['enabled'] = kill_switch_enabled

        logger.info(f"âœ… RAM'deki CONFIG gÃ¼ncellendi (hot-reload)")

        # RiskEngine'i re-initialize et (yeni ayarlarla)
        from core.paper import paper_engine
        if hasattr(paper_engine, 'risk_engine'):
            paper_engine.risk_engine.config.max_risk_per_trade = max_risk / 100.0
            paper_engine.risk_engine.config.max_leverage = max_leverage
            paper_engine.risk_engine.config.max_open_positions = max_positions
            paper_engine.risk_engine.config.max_consecutive_losses = max_losses
            paper_engine.risk_engine.config.kill_switch_enabled = kill_switch_enabled
            logger.info(f"âœ… RiskEngine ve PaperTrader ayarlarÄ± gÃ¼ncellendi (Hot-Reload)")

        return {
            "status": "success",
            "message": "Risk ayarlarÄ± gÃ¼ncellendi",
            "data": {
                "max_risk_per_trade_percent": max_risk,
                "max_leverage": max_leverage,
                "max_open_positions": max_positions,
                "max_consecutive_losses": max_losses,
                "kill_switch_enabled": kill_switch_enabled
            }
        }

    except ValueError as ve:
        logger.error(f"âŒ Validasyon hatasÄ±: {ve}")
        return {
            "status": "error",
            "message": str(ve),
            "data": {}
        }
    except Exception as e:
        logger.error(f"âŒ Risk config gÃ¼ncelleme hatasÄ±: {e}")
        return {
            "status": "error",
            "message": f"Risk config gÃ¼ncelleme hatasÄ±: {str(e)}",
            "data": {}
        }


# ============================================================================
# ADVANCED CONFIG ENDPOINTS (WFO, ML, HTF)
# ============================================================================

@router.get("/config/advanced")
async def get_advanced_config() -> Dict[str, Any]:
    """
    GeliÅŸmiÅŸ ayarlarÄ± dÃ¶ner (WFO, ML, HTF).
    
    Returns:
        wfo: WFO ayarlarÄ±
        ml: ML ayarlarÄ±
        htf: HTF ayarlarÄ±
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
        logger.error(f"âŒ Advanced config okuma hatasÄ±: {e}")
        return {
            "status": "error",
            "message": f"Advanced config okuma hatasÄ±: {str(e)}",
            "data": {}
        }


@router.post("/config/advanced")
async def update_advanced_config(request: dict) -> Dict[str, Any]:
    """
    GeliÅŸmiÅŸ ayarlarÄ± gÃ¼nceller (WFO, ML, HTF).
    
    Request Body:
        wfo: {enabled, train_days, test_days, reoptimize_interval}
        ml: {enabled, confidence_threshold}
        htf: {enabled, trend_method}
    
    Returns:
        status: success/error
        message: Ä°ÅŸlem sonucu
        data: GÃ¼ncellenen ayarlar
    """
    try:
        import yaml
        from core.config import CONFIG
        
        logger.info(f"ğŸ”§ GeliÅŸmiÅŸ ayarlar gÃ¼ncelleniyor...")
        
        # config.yaml'Ä± yÃ¼kle
        with open('config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # WFO ayarlarÄ±
        if 'wfo' in request:
            wfo = request['wfo']
            config['wfo']['enabled'] = bool(wfo.get('enabled', True))
            config['wfo']['train_days'] = int(wfo.get('train_days', 30))
            config['wfo']['test_days'] = int(wfo.get('test_days', 7))
            config['wfo']['reoptimize_interval'] = int(wfo.get('reoptimize_interval', 168))
            logger.info(f"âœ… WFO gÃ¼ncellendi: enabled={config['wfo']['enabled']}")
        
        # ML ayarlarÄ±
        if 'ml' in request:
            ml = request['ml']
            config['ml']['enabled'] = bool(ml.get('enabled', True))
            config['ml']['confidence_threshold'] = float(ml.get('confidence_threshold', 0.65))
            logger.info(f"âœ… ML gÃ¼ncellendi: enabled={config['ml']['enabled']}, threshold={config['ml']['confidence_threshold']}")
        
        # HTF ayarlarÄ±
        if 'htf' in request:
            htf = request['htf']
            config['htf']['enabled'] = bool(htf.get('enabled', True))
            config['htf']['trend_method'] = str(htf.get('trend_method', 'ema_stack'))
            logger.info(f"âœ… HTF gÃ¼ncellendi: enabled={config['htf']['enabled']}")

        # YENÄ°: Kalman Filtresi
        if 'kalman_smoothing' in request:
            kalman = request['kalman_smoothing']
            config['kalman_smoothing']['enabled'] = bool(kalman.get('enabled', False))
            config['kalman_smoothing']['process_noise'] = float(kalman.get('process_noise', 0.001))
            config['kalman_smoothing']['measurement_noise'] = float(kalman.get('measurement_noise', 0.1))
            logger.info(f"âœ… Kalman gÃ¼ncellendi: enabled={config['kalman_smoothing']['enabled']}, Q={config['kalman_smoothing']['process_noise']}, R={config['kalman_smoothing']['measurement_noise']}")

        # YENÄ°: Mum KapanÄ±ÅŸ Kilidi
        if 'candle_close_lock' in request:
            candle_lock = request['candle_close_lock']
            config['candle_close_lock']['enabled'] = bool(candle_lock.get('enabled', True))
            config['candle_close_lock']['check_interval'] = int(candle_lock.get('check_interval', 5))
            logger.info(f"âœ… Candle Lock gÃ¼ncellendi: enabled={config['candle_close_lock']['enabled']}, interval={config['candle_close_lock']['check_interval']}s")
        
        # config.yaml'a yaz
        with open('config.yaml', 'w', encoding='utf-8') as f:
            yaml.safe_dump(config, f, default_flow_style=False, allow_unicode=True)
        
        logger.info(f"âœ… config.yaml gÃ¼ncellendi")
        
        # RAM'deki CONFIG'i gÃ¼ncelle (hot-reload)
        if 'wfo' in request:
            CONFIG['wfo'].update(config['wfo'])
        if 'ml' in request:
            CONFIG['ml'].update(config['ml'])
            # PaperTrader instance'Ä±ndaki ml_enabled'Ä± gÃ¼ncelle
            from core.paper import paper_engine
            paper_engine.ml_enabled = config['ml'].get('enabled', True)
            logger.info(f"âœ… PaperTrader ML status: {paper_engine.ml_enabled}")
        if 'htf' in request:
            CONFIG['htf'].update(config['htf'])
        if 'kalman_smoothing' in request:
            CONFIG['kalman_smoothing'].update(config['kalman_smoothing'])
        if 'candle_close_lock' in request:
            CONFIG['candle_close_lock'].update(config['candle_close_lock'])

        logger.info(f"âœ… RAM'deki CONFIG gÃ¼ncellendi (hot-reload)")

        return {
            "status": "success",
            "message": "GeliÅŸmiÅŸ ayarlar gÃ¼ncellendi",
            "data": {
                "wfo": config.get('wfo', {}),
                "ml": config.get('ml', {}),
                "htf": config.get('htf', {}),
                "kalman_smoothing": config.get('kalman_smoothing', {}),
                "candle_close_lock": config.get('candle_close_lock', {})
            }
        }

    except Exception as e:
        logger.error(f"âŒ Advanced config gÃ¼ncelleme hatasÄ±: {e}")
        return {
            "status": "error",
            "message": f"Advanced config gÃ¼ncelleme hatasÄ±: {str(e)}",
            "data": {}
        }


# ============================================================================
# BOT CONFIG ENDPOINTS (GeÃ§ici olarak devre dÄ±ÅŸÄ± - bot.py'de var)
# ============================================================================

# @router.get("/config/bot")
# async def get_bot_config() -> BotConfigResponse:
#     ...

# @router.post("/config/bot", response_model=BotConfigResponse)
# async def update_bot_config(request: BotConfigRequest) -> BotConfigResponse:
#     ...

        import yaml

        # 1. CONFIG global sÃ¶zlÃ¼ÄŸÃ¼nÃ¼ gÃ¼ncelle (Hot-Reload)
        if 'risk_management' not in CONFIG:
            CONFIG['risk_management'] = {}

        CONFIG['risk_management']['max_risk_per_trade_percent'] = request.max_risk_per_trade_percent
        CONFIG['risk_management']['max_leverage'] = request.max_leverage
        CONFIG['risk_management']['max_open_positions'] = request.max_open_positions
        CONFIG['risk_management']['max_consecutive_losses'] = request.max_consecutive_losses

        # 2. config.yaml dosyasÄ±na yaz
        config_path = Path("config.yaml")
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f)

            if 'risk_management' not in config_data:
                config_data['risk_management'] = {}

            config_data['risk_management'].update({
                'max_risk_per_trade_percent': request.max_risk_per_trade_percent,
                'max_leverage': request.max_leverage,
                'max_open_positions': request.max_open_positions,
                'max_consecutive_losses': request.max_consecutive_losses
            })

            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_data, f, default_flow_style=False, allow_unicode=True)

        # 3. Runtime objelerini re-initialize et
        if hasattr(paper_engine, 'risk_engine') and hasattr(paper_engine.risk_engine, 'config'):
            paper_engine.risk_engine.config['max_risk_per_trade'] = request.max_risk_per_trade_percent

        logger.info(f"âœ… Risk config updated: {request.max_risk_per_trade_percent}% risk, {request.max_leverage}x leverage")

        return {
            "status": "success",
            "message": "Risk ayarlarÄ± gÃ¼ncellendi (Hot-Reload)",
            "config": {
                "max_risk_per_trade_percent": request.max_risk_per_trade_percent,
                "max_leverage": request.max_leverage,
                "max_open_positions": request.max_open_positions,
                "max_consecutive_losses": request.max_consecutive_losses
            }
        }
    except Exception as e:
        logger.error(f"âŒ Risk config update error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# ADVANCED CONFIG ENDPOINTS
# ============================================================================

@router.get("/config/advanced")
async def get_advanced_config() -> Dict[str, Any]:
    """
    GeliÅŸmiÅŸ ayarlarÄ± Ã§ek (WFO, ML, HTF, Kalman, Candle Lock).
    """
    try:
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
    except Exception as e:
        logger.error(f"âŒ Advanced config get error: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/config/advanced")
async def update_advanced_config(request: AdvancedConfigUpdate) -> Dict[str, Any]:
    """
    GeliÅŸmiÅŸ ayarlarÄ± gÃ¼ncelle (Hot-Reload).
    """
    try:
        import yaml

        # 1. CONFIG global sÃ¶zlÃ¼ÄŸÃ¼nÃ¼ gÃ¼ncelle
        if request.wfo:
            CONFIG['wfo'] = request.wfo.dict()
        if request.ml:
            CONFIG['ml'] = request.ml.dict()
        if request.htf:
            CONFIG['htf'] = request.htf.dict()
        if request.kalman:
            CONFIG['kalman'] = request.kalman.dict()
        if request.candle_lock:
            CONFIG['candle_lock'] = request.candle_lock.dict()

        # 2. config.yaml dosyasÄ±na yaz
        config_path = Path("config.yaml")
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f)

            if request.wfo:
                config_data['wfo'] = request.wfo.dict()
            if request.ml:
                config_data['ml'] = request.ml.dict()
            if request.htf:
                config_data['htf'] = request.htf.dict()
            if request.kalman:
                config_data['kalman'] = request.kalman.dict()
            if request.candle_lock:
                config_data['candle_lock'] = request.candle_lock.dict()

            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.safe_dump(config_data, f, default_flow_style=False, allow_unicode=True)

        logger.info(f"âœ… Advanced config updated")

        return {
            "status": "success",
            "message": "GeliÅŸmiÅŸ ayarlar gÃ¼ncellendi (Hot-Reload)",
            "config": {
                "wfo": CONFIG.get('wfo', {}),
                "ml": CONFIG.get('ml', {}),
                "htf": CONFIG.get('htf', {}),
                "kalman": CONFIG.get('kalman', {}),
                "candle_lock": CONFIG.get('candle_lock', {})
            }
        }
    except Exception as e:
        logger.error(f"âŒ Advanced config update error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# API KEY ENDPOINTS
# ============================================================================

@router.post("/config/api-keys")
async def save_api_keys(request: ApiKeyUpdateRequest) -> Dict[str, Any]:
    """
    API anahtarlarÄ±nÄ± ÅŸifreleyerek kaydet.
    """
    try:
        from core.security import KeyManager

        # Åifrele ve kaydet
        key_manager = KeyManager()
        key_manager.save_api_keys(request.api_key, request.api_secret)

        logger.info(f"âœ… API anahtarlarÄ± ÅŸifrelenerek kaydedildi")

        return {
            "status": "success",
            "message": "API anahtarlarÄ± ÅŸifrelenerek kaydedildi"
        }
    except Exception as e:
        logger.error(f"âŒ API key save error: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/config/test-api-keys")
async def test_api_keys(request: ApiKeyUpdateRequest) -> Dict[str, Any]:
    """
    API anahtarlarÄ±nÄ± CCXT ile test et.
    """
    try:
        import ccxt.async_support as ccxt

        logger.info(f"ğŸ§ª API anahtarlarÄ± test ediliyor...")

        # CCXT exchange oluÅŸtur
        exchange = ccxt.binance({
            'apiKey': request.api_key,
            'secret': request.api_secret,
            'enableRateLimit': True,
            'options': {'defaultType': 'future'}
        })

        # Balance Ã§ek (test)
        balance = await exchange.fetch_balance()
        await exchange.close()

        usdt_balance = balance.get('total', {}).get('USDT', 0)

        logger.info(f"âœ… API anahtarlarÄ± geÃ§erli! USDT: {usdt_balance}")

        return {
            "status": "success",
            "message": f"API anahtarlarÄ± geÃ§erli! USDT: {usdt_balance}",
            "valid": True,
            "usdt_balance": usdt_balance
        }
    except Exception as e:
        logger.error(f"âŒ API keys test error: {e}")
        return {
            "status": "error",
            "message": f"API keys test hatasÄ±: {str(e)}",
            "valid": False
        }
