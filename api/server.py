from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, Any

from core.logger import logger
from core.config import CONFIG
from data.database import db_manager
from core.exchange import exchange_manager
from api.routers.strategy_builder import router as strategy_builder_router
from api.routers.backtest import router as backtest_router
import asyncio
import pandas as pd
import numpy as np

# --- PROJE BAŞLATMA (LIFESPAN) VE ARKA PLAN BOT GÖREVLERİ ---
async def start_bot_tasks():
    logger.info("FastAPI Sunucusu ayağa kalktı. Bot alt görevleri başlatılıyor...")
    await db_manager.connect()
    # Yarım kalan indirme görevlerini geri yükle (Durdurulmuş/Duraklatılmış olanlar)
    await exchange_manager.load_tasks_from_db()
    
    tasks = []
    for symbol in CONFIG['trading']['symbols']:
        # Botun gerçek zamanlı Ticker Görevi
        tasks.append(asyncio.create_task(exchange_manager.watch_ticker_loop(symbol)))
        # Botun ML Karar ve Mum İnceleme Görevi
        tasks.append(asyncio.create_task(exchange_manager.run_strategy_poller(symbol)))
        
    await asyncio.gather(*tasks)

async def shutdown_bot_tasks():
    logger.info("FastAPI Sunucusu kapanıyor. Bot sistemleri devredışı bırakılıyor...")
    await exchange_manager.close()
    await db_manager.close()

# FastAPI Uygulaması
app = FastAPI(
    title="CryptoAlgoBot Core API",
    description="Bot ile Arayüz (Dashboard) arasında güvenli ve hızlı veri köprüsü.",
    version="1.0.0"
)

# Arayüz Frontend'den gelecek istekleri kabul edebilmek için CORS izni
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Geliştirme sürecinde herkes erişebilir. Canlıda Dashboard URL'siyle değiştirilir.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Strategy Builder Router
app.include_router(strategy_builder_router)

# Backtest Router
app.include_router(backtest_router)

@app.on_event("startup")
async def startup_event():
    # Arka planda botun asıl döngüsünü engellemeden çalıştır
    asyncio.create_task(start_bot_tasks())

@app.on_event("shutdown")
async def shutdown_event():
    await shutdown_bot_tasks()

# --- API UÇ NOKTALARI (ENDPOINTS) ARAYÜZ İÇİN ---

def _normalize_market_type(market_type_str: str, symbol: str) -> str:
    """Converts user-facing market type strings into system-level 'spot' or 'future' types."""
    lowered_str = str(market_type_str).lower()
    # Check for keywords that strongly indicate a futures market
    if any(keyword in lowered_str for keyword in ['perp', 'future', 'vadeli', 'swap']):
        return 'future'
    # As a robust fallback, check the symbol structure itself.
    # Binance often uses ':' for futures (e.g., 'BTC/USDT:USDT') or specific suffixes.
    if ':' in symbol or symbol.endswith('-SWAP'):
        return 'future'
    return 'spot'

@app.get("/api/v1/status")
async def get_system_status() -> Dict[str, Any]:
    """Sistemin ayakta olup olmadığını, hangi modda ve kriptolarda çalıştığını döner."""
    return {
        "status": "online",
        "environment": CONFIG['bot']['environment'],
        "exchange": CONFIG['trading']['exchange'],
        "tracking_symbols": CONFIG['trading']['symbols']
    }

@app.get("/api/v1/strategy-report")
async def get_strategy_performance_report():
    """Tüm işlemler üzerinden strateji bazlı detaylı röntgen/karne raporunu döner."""
    from core.paper import paper_engine
    return {"status": "success", "report": paper_engine.get_strategy_report()}

# --- YENİ MARKET VE SEMBOL YÖNETİMİ ---

@app.get("/api/v1/exchange/markets")
async def get_exchange_markets():
    """Borsadaki tüm aktif USDT işlem çiftlerini döner."""
    markets = await exchange_manager.fetch_available_markets()
    return {"markets": markets}

@app.get("/api/v1/config/symbols")
async def get_tracked_symbols():
    """Şu an botun izlediği sembollerin listesini döner."""
    return {"symbols": CONFIG['trading']['symbols']}

@app.get("/api/v1/data/symbols-with-data")
async def get_db_symbols():
    """Veritabanında verisi olan tüm sembolleri döner."""
    symbols = await db_manager.get_symbols_with_data()
    return {"symbols": symbols}

async def start_symbol_tasks(symbol: str, market_type: str = 'swap', margin_type: str = 'isolated'):
    """Yeni bir sembol için CCXT ve Strateji döngüsünü başlatır."""
    from core.paper import paper_engine
    if symbol not in CONFIG['trading']['symbols']:
        CONFIG['trading']['symbols'].append(symbol)
        
        # Paper engine ayarlarını yap
        paper_engine.set_market_type(symbol, market_type)
        paper_engine.set_margin_type(symbol, margin_type)
        
        asyncio.create_task(exchange_manager.watch_ticker_loop(symbol))
        asyncio.create_task(exchange_manager.run_strategy_poller(symbol))
        logger.info(f"🆕 {symbol} ({market_type}/{margin_type}) için görevler dinamik olarak başlatıldı.")

@app.post("/api/v1/config/symbols")
async def update_tracked_symbols(data: Dict[str, list]):
    """Botun izleyeceği sembol listesini günceller ve yeni görevleri başlatır."""
    new_symbols = data.get("symbols", [])
    
    current_symbols = list(CONFIG['trading']['symbols'])
    added_symbols = [s for s in new_symbols if s not in current_symbols]
    
    for symbol in added_symbols:
        await start_symbol_tasks(symbol)

    CONFIG['trading']['symbols'] = new_symbols
    return {"status": "success", "updated_symbols": new_symbols}

# --- VERİ YÖNETİMİ ENDPOINTS ---

@app.get("/api/v1/data/history-status")
async def get_history_status(symbol: str, timeframe: str = '1m'):
    """Seçili sembolün veritabanındaki tarih aralığını döner."""
    data_range = await db_manager.get_candle_range(symbol, timeframe)
    if data_range:
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "start_date": pd.to_datetime(data_range['start'], unit='ms').strftime('%Y-%m-%d %H:%M'),
            "end_date": pd.to_datetime(data_range['end'], unit='ms').strftime('%Y-%m-%d %H:%M'),
            "count_hint": "Dinamik hesaplanabilir"
        }
    return {"symbol": symbol, "status": "no_data"}

@app.post("/api/v1/data/download-history")
async def start_historical_download(data: Dict[str, Any], background_tasks: BackgroundTasks):
    """Arka planda geçmiş veri indirme işlemini başlatır."""
    raw_symbol = data.get("symbol")
    # Gelen sembol ismini temizle (Suffix varsa temizle)
    symbol = raw_symbol.split('_')[0].strip() if raw_symbol and '_' in raw_symbol else raw_symbol
    
    timeframe = data.get("timeframe", "1m")
    start_date = data.get("start_date", "2024-01-01")
    market_type = data.get("market_type", "future")
    
    if not symbol:
        return {"status": "error", "message": "Sembol belirtilmedi."}

    m_type = _normalize_market_type(market_type, symbol)

    key = f"{symbol}_{m_type}"
    
    if key in exchange_manager.active_downloads:
        task = exchange_manager.active_downloads[key]
        return {
            "status": "exists", 
            "message": f"{key} için zaten bir kayıt ({task['status'].upper()}) bulunuyor.",
            "task": task
        }
    
    # Arka planda indirmeyi başlat
    background_tasks.add_task(exchange_manager.download_historical_data, symbol, timeframe, start_date, m_type)
    
    return {
        "status": "started",
        "message": f"{key} ({m_type}) için {start_date} tarihinden itibaren veri indirme görevi başlatıldı."
    }

@app.post("/api/v1/data/stop-download")
async def stop_historical_download(data: Dict[str, str]):
    """Devam eden indirme işlemini durdurur."""
    raw_key = data.get("symbol") # UI'dan key veya symbol gelebilir
    if not raw_key: return {"status": "error", "message": "Sembol belirtilmedi."}
    
    # Eğer gelen şey zaten bir anahtarsa (Örn: BTC/USDT_spot), direkt kullan
    # Değilse (Örn: BTC/USDT), varsayılan bir tip eklemek riskli olabilir 
    # ama genelde UI'dan KEY gelir.
    key = raw_key
    exchange_manager.download_stops[key] = True
    return {"status": "success", "message": f"{key} durdurma sinyali gönderildi."}

@app.post("/api/v1/data/resume-download")
async def resume_historical_download(data: Dict[str, str], background_tasks: BackgroundTasks):
    """Durdurulmuş veya tamamlanmış indirme işlemini kaldığı yerden yeniden başlatır."""
    key = data.get("symbol") # UI'dan key geliyor (Örn: BTC/USDT_spot)
    
    # RAM'de yoksa ama DB'de varsa, RAM'e yükle (is_resume için)
    if key not in exchange_manager.active_downloads:
        tasks = await db_manager.get_all_download_tasks()
        for t in tasks:
            m_type = str(t['market_type']).lower()
            if f"{t['symbol']}_{m_type}" == key:
                exchange_manager.active_downloads[key] = dict(t)
                break
            
    if key in exchange_manager.active_downloads:
        task = exchange_manager.active_downloads[key]
        task['status'] = 'running'
        exchange_manager.download_stops[key] = False
        exchange_manager.download_pauses[key] = False
        
        # Kaldığı yerden devam etmesini söyle (Real symbol'u kullan!)
        real_symbol = task['symbol'].split('_')[0] if '_' in task['symbol'] else task['symbol']
        background_tasks.add_task(
            exchange_manager.download_historical_data, 
            real_symbol, task['timeframe'], task['start_date'], task['market_type'], is_resume=True
        )
        return {"status": "success", "message": f"{key} kaldığı yerden devam ediyor."}
        
    return {"status": "error", "message": "Görev bulunamadı. Yeni bir görev başlatın."}

@app.get("/api/v1/data/active-downloads")
async def get_active_downloads():
    """Tüm indirme görevlerini (aktif, durdurulmuş, tamamlanmış) veritabanından ve hafızadan listeler."""
    db_tasks = await db_manager.get_all_download_tasks()
    task_map = {}

    # DB'den gelen görevleri işle
    for t in db_tasks:
        symbol = t['symbol']
        # Use the centralized normalization function
        normalized_market_type = _normalize_market_type(t['market_type'], symbol)
        key = f"{symbol}_{normalized_market_type}"

        task_map[key] = dict(t)
        task_map[key]['market_type'] = normalized_market_type
    
    # RAM'dekileri de ekle (Hafıza her zaman günceldir ve DB'yi ezer)
    for key, meta in exchange_manager.active_downloads.items():
        m_copy = dict(meta)
        # Ensure symbol is present for normalization
        symbol = m_copy.get('symbol', key.split('_')[0])
        m_copy['market_type'] = _normalize_market_type(m_copy.get('market_type', ''), symbol)
        task_map[key] = m_copy


    # 2. Önemli: DB'de klines verisi olan ama görev listesinde olmayanları ekle
    data_symbols = await db_manager.get_symbols_with_data()
    
    def get_base_symbol(symbol_or_key: str):
        base = symbol_or_key.split('_')[0]
        base = base.split(':')[0]
        return base.strip()

    managed_base_symbols = {get_base_symbol(key) for key in task_map.keys()}

    for s in data_symbols:
        s_norm = s.strip()
        base_symbol_from_kline = get_base_symbol(s_norm)
        
        if base_symbol_from_kline not in managed_base_symbols:
            guessed_type = 'spot'
            if ':' in s_norm or s_norm.endswith('-SWAP'): 
                guessed_type = 'future'

            key = f"{s_norm}_{guessed_type}"
            if key not in task_map:
                candle_range = await db_manager.get_candle_range(s_norm)
                task_map[key] = {
                    'symbol': s_norm,
                    'status': 'completed',
                    'timeframe': '--', 
                    'market_type': guessed_type,
                    'start_date': None,
                    'target_start_ms': candle_range['start'] if candle_range else 0,
                    'current_ts': candle_range['end'] if candle_range else 0,
                    'is_orphaned': True
                }

    return task_map

@app.post("/api/v1/data/delete-task")
async def delete_download_task(data: Dict[str, Any]):
    """Görevi (ve isteğe bağlı olarak verilerini) tamamen ve hassas bir şekilde siler."""
    key = data.get("symbol")
    if not key:
        return {"status": "error", "message": "Silinecek görev anahtarı belirtilmedi."}
        
    with_data = data.get("with_data", False)

    # 1. Eğer çalışıyorsa önce durdurma sinyali gönder
    exchange_manager.download_stops[key] = True
    await asyncio.sleep(0.5) # Sinyalin işlenmesi için kısa bir süre bekle
    
    # 2. RAM'den temizle
    if key in exchange_manager.active_downloads:
        del exchange_manager.active_downloads[key]
        
    # 3. Veritabanından görev kaydını hassas bir şekilde sil
    # Anahtarı (key) sembol ve market tipine doğru bir şekilde ayır
    try:
        last_underscore_idx = key.rfind('_')
        if last_underscore_idx == -1:
            raise ValueError("Anahtar formatı geçersiz.")
            
        real_symbol = key[:last_underscore_idx]
        market_type = key[last_underscore_idx+1:]
        
        # market_type'ın 'spot' veya 'future' olduğundan emin ol
        if market_type not in ['spot', 'future']:
            # If the parsing is not clean, re-normalize based on the symbol
            market_type = _normalize_market_type(market_type, real_symbol)

        await db_manager.delete_download_task(real_symbol, market_type)
        
        # 4. Eğer kullanıcı verileri de silmek istediyse, sadece o sembole ait verileri sil
        if with_data:
            await db_manager.delete_klines_for_symbol(real_symbol)
            
        return {"status": "success", "message": f"{key} görevi başarıyla silindi."}

    except Exception as e:
        logger.error(f"Görev silinirken hata oluştu: {key} | Hata: {e}")
        return {"status": "error", "message": f"Görev silinirken bir hata oluştu: {e}"}

@app.post("/api/v1/data/toggle-pause")
async def toggle_pause_download(data: Dict[str, str]):
    """İndirme işlemini duraklatır veya devam ettirir."""
    key = data.get("symbol") # UI'dan key geliyor
    if key in exchange_manager.active_downloads:
        current_state = exchange_manager.download_pauses.get(key, False)
        exchange_manager.download_pauses[key] = not current_state
        return {
            "status": "success", 
            "paused": not current_state,
            "message": f"{key} {'duraklatıldı' if not current_state else 'devam ettiriliyor'}."
        }
    return {"status": "error", "message": "Aktif görev bulunamadı."}

from core.paper import paper_engine

@app.get("/api/v1/debug-ids")
async def get_debug_ids():
    global paper_engine
    from core.exchange import exchange_manager
    ex_paper_id = getattr(exchange_manager, 'debug_paper_id', None)
    return {"api_server_paper_engine_id": id(paper_engine), "exchange_manager_paper_id": ex_paper_id}

@app.get("/api/v1/dashboard-metrics")
async def get_dashboard_metrics() -> Dict[str, Any]:
    """Sanal borsa (PaperTrader) motorundaki gerçek canlı verileri döndürür."""
    global paper_engine
    stats = paper_engine.get_stats()
    unrealized_pnl = sum(pos['unrealized_usd'] for pos in paper_engine.open_positions)
    
    # ROI = (Mevcut Kasa - İlk Kasa) / İlk Kasa * 100
    roi_percent = ((stats['equity'] - paper_engine.initial_balance) / paper_engine.initial_balance) * 100

    return {
        "portfolio": {
            "total_balance": stats['balance'],
            "equity": stats['equity'],
            "unrealized_pnl": unrealized_pnl,
            "daily_roi_percent": round(roi_percent, 2),
            "free_margin": stats['free_margin'],
            "used_margin": stats['used_margin'],
            "total_notional": stats['total_notional'],
            "avg_leverage": round(stats['avg_leverage'], 1),
            "win_rate": stats['win_rate'],
            "total_trades": stats['total_trades'],
            "total_commission": stats['total_commission'],
            "total_pnl": stats['total_pnl'],
            "market_regime": stats.get('market_regime', 'UNKNOWN')
        },
        "ml_engine": {
            "active_strategies": paper_engine.active_strategies,
            "global_confidence": paper_engine.global_confidence,
            "volatility_shield": paper_engine.volatility_shield
        },
        "open_positions": paper_engine.open_positions,
        "latest_decisions": paper_engine.latest_decisions,
        "system": {
            "timeframe": next(iter(paper_engine.active_timeframes.values())) if paper_engine.active_timeframes else "1m",
            "fees": {"maker": 0.0002, "taker": 0.0004} # Örnek borsa oranları
        }
    }

@app.post("/api/v1/position/close")
async def close_position(data: Dict[str, str]):
    """Belirli bir paritedeki açık pozisyonu manuel kapatır."""
    symbol = data.get("symbol")
    success = await paper_engine.close_position_by_symbol(symbol)
    return {"status": "success" if success else "failed"}

@app.get("/api/v1/trade-history")
async def get_trade_history() -> Dict[str, Any]:
    """Geçmişte yapılmış ve kapatılmış tüm işlemleri döner."""
    trades = await db_manager.get_recent_trades(limit=50)
    return {"trades": trades}

# --- YENİ ÇOKLU STRATEJİ YÖNETİMİ ---

@app.get("/api/v1/strategies")
async def list_available_strategies():
    """Botun kullanabileceği tüm farklı karakter (İndikatör Setleri) listesini döner."""
    from strategy.manager import StrategyManager
    return {
        "active_strategies": paper_engine.active_strategies,
        "active_timeframes": paper_engine.active_timeframes,
        "market_types": paper_engine.market_types,
        "margin_types": paper_engine.margin_types,
        "strategies": StrategyManager.list_all_strategies()
    }

@app.get("/api/v1/ml/visual-analysis")
async def get_ml_visual_analysis(symbol: str = "BTC/USDT", limit: int = 200, strategy_id: str = None, timeframe: str = "1m"):
    """
    ML modelinin ve seçili teknik stratejinin kararlarını görselleştirmek için veri hazırlar.
    Seçilen zaman dilimine göre (Resampling) verileri yeniden yapılandırır.
    """
    try:
        from data.indicators import StrategyIndicators
        from data.features import AdvancedFeatures
        from strategy.manager import StrategyManager
        import pickle
        import os
        
        # 1. Veriyi Hazırla (Resampling için daha fazla ham veri çekiyoruz)
        fetch_limit = limit
        if timeframe != "1m":
            fetch_limit = 2000 # Daha büyük periyotlar için daha fazla 1m mumu lazım

        ohlcv = await exchange_manager.fetch_ohlcv(symbol, limit=fetch_limit)
        if not ohlcv:
            return {"status": "error", "message": "Borsadan veri çekilemedi. Lütfen pariteyi kontrol edin."}
            
        df_raw = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # Zaman Dilimi Dönüşümü (Resampling)
        df = StrategyIndicators.resample_data(df_raw, timeframe)
        
        # İndikatörleri ve Özellikleri Ekle
        df = StrategyIndicators.add_all_indicators(df)
        df['volatility_ema'] = AdvancedFeatures.get_volatility(df['close'], span=20)
        
        # Tüm sayısal olmayan değerleri (NaN, Inf) temizle (JSON uyumluluğu için ŞART)
        df.replace([np.inf, -np.inf], np.nan, inplace=True)
        df.fillna(0, inplace=True)
        
        # Görüntüleme için son 'limit' kadar mum al
        if len(df) > limit:
            df = df.tail(limit).copy()
        
        # 2 & 3. YÜKSEK KALİTELİ BACKTEST SİMÜLASYONU VE ML ENTEGRASYONU
        predictions = []
        strategy_signals = []
        actual_trades = [] # Sadece botun gerçekten işleme girdiği noktalar
        
        strat_name = "YOK"
        if strategy_id:
            strategy = StrategyManager.get_strategy(strategy_id)
            strat_name = strategy.name()

        model_path = "artifacts/trained_models/xgb_model.pkl"
        xgb_model = None
        if os.path.exists(model_path):
            try:
                with open(model_path, 'rb') as f:
                    xgb_model = pickle.load(f)
            except Exception as e:
                logger.error(f"Bagli model acilamadi: {e}")

        # Beklenen Sütunlar
        expected_cols = [
            'open', 'high', 'low', 'close', 'volume', 
            'SMA_20', 'EMA_50', 'RSI_14', 
            'MACD_12_26_9', 'MACDs_12_26_9', 'MACDh_12_26_9',
            'ATR_14', 'BBU_20_2.0_2.0', 'BBL_20_2.0_2.0', 'VWAP', 'volatility_ema'
        ]
        available_cols = [c for c in expected_cols if c in df.columns]

        # ML Model Toplu Tahmin
        if xgb_model and not df.empty and len(available_cols) > 5:
            X = df[available_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
            from xgboost import DMatrix
            dtest = DMatrix(X.values, feature_names=available_cols)
            probs = xgb_model.model.predict(dtest)
            df['ml_idx'] = np.argmax(probs, axis=1)
            df['ml_conf'] = np.max(probs, axis=1)
            
            f_scores = xgb_model.model.get_score(importance_type='weight')
            if f_scores:
                total = sum(f_scores.values())
                feature_importance = {k: round(v/total, 3) for k, v in f_scores.items()} if total > 0 else {}
        else:
            df['ml_idx'] = 1
            df['ml_conf'] = 0.0

        # Mükerrer (Gürültü) sinyalleri engellemek için durum takibi
        in_trade = False
        trade_dir = None
        
        for i in range(len(df)):
            candle = df.iloc[i]
            ts = candle['timestamp']
            close_p = float(candle['close'])
            
            # Strateji
            sig = strategy.generate_signal(candle) if strategy_id else 1
            
            # ML
            m_idx = int(df.iloc[i]['ml_idx'])
            m_cnf = float(df.iloc[i]['ml_conf'])
            
            # Arka plan verisi olarak kaydet (Grafikte gizli detay olarak çizilecek)
            if sig != 1:
                strategy_signals.append({"timestamp": ts, "signal": sig, "price": close_p})
            if m_idx != 1 and m_cnf >= 0.60:
                predictions.append({"timestamp": ts, "choice": m_idx, "confidence": m_cnf, "price": close_p})
                
            # GERÇEK AL-SAT SİMÜLASYONU (Kesişim + HTF Teyidi)
            threshold = 0.60
            
            # --- HTF TREND ANALİZİ (Görsel Analiz İçin Dinamik Hesaplama) ---
            # df zaten ham veriyi içeriyor, buradan HTF trendini bulalım
            # Basitçe son 50 mumun EMA 50 üstünde olup olmamasına bakabiliriz (HTF simülasyonu)
            htf_bull = candle['close'] > candle.get('EMA_50', candle['close'])
            htf_bear = candle['close'] < candle.get('EMA_50', candle['close'])

            if not in_trade:
                # İŞLEME GİRİŞ (Strateji + ML + HTF Teyidi)
                # HTF filtresini esnettik - sadece zıt trendi engelle
                if sig == 2 and m_idx == 2 and m_cnf >= threshold:
                    # LONG için: HTF BEAR değilse gir (BULL veya nötr olabilir)
                    if not htf_bear:
                        actual_trades.append({"timestamp": ts, "action": "LONG_ENTER", "price": close_p})
                        in_trade = True
                        trade_dir = "LONG"
                elif sig == 0 and m_idx == 0 and m_cnf >= threshold:
                    # SHORT için: HTF BULL değilse gir (BEAR veya nötr olabilir)
                    if not htf_bull:
                        actual_trades.append({"timestamp": ts, "action": "SHORT_ENTER", "price": close_p})
                        in_trade = True
                        trade_dir = "SHORT"
            else:
                # İŞLEMDEN ÇIKIŞ (Tam tersi sinyal gelirse veya ATR Stobu patlarsa)
                if trade_dir == "LONG" and (sig == 0 or m_idx == 0):
                    actual_trades.append({"timestamp": ts, "action": "LONG_EXIT", "price": close_p})
                    in_trade = False
                elif trade_dir == "SHORT" and (sig == 2 or m_idx == 2):
                    actual_trades.append({"timestamp": ts, "action": "SHORT_EXIT", "price": close_p})
                    in_trade = False

        # 4. Sonuçları Paketle (Milisaniye Senkronizasyonu)
        def ensure_ms(ts_val):
            try:
                # Eğer pandas timestamp, datetime veya float ise
                if hasattr(ts_val, 'timestamp'):
                    ts_val = ts_val.timestamp() if callable(ts_val.timestamp) else ts_val.timestamp
                val = float(ts_val)
                if val < 4000000000: return int(val * 1000) 
                return int(val)
            except Exception:
                return 0

        for p in predictions: p['timestamp'] = ensure_ms(p['timestamp'])
        for s in strategy_signals: s['timestamp'] = ensure_ms(s['timestamp'])
        for t in actual_trades: t['timestamp'] = ensure_ms(t['timestamp'])

        display_records = []
        for _, row in df.iterrows():
            display_records.append({
                "timestamp": ensure_ms(row['timestamp']),
                "open": float(row['open']), "high": float(row['high']),
                "low": float(row['low']), "close": float(row['close']),
                "volume": float(row['volume'])
            })
        
        return {
            "status": "success",
            "symbol": symbol,
            "strategy_name": strat_name,
            "candles": display_records,
            "ml_predictions": predictions,
            "strategy_signals": strategy_signals,
            "actual_trades": actual_trades,
            "feature_importance": feature_importance
        }
    except Exception as gl_err:
        logger.error(f"Global Visual Analysis Error: {gl_err}")
        return {"status": "error", "message": f"Analiz sırasında sistem hatası: {str(gl_err)}"}

from pydantic import BaseModel
from typing import Optional

class StrategySelectSchema(BaseModel):
    strategy_id: str
    symbol: Optional[str] = None # Eğer boşsa global (tüm coinler) değişir
    timeframe: str = "1m"
    market_type: str = "swap"   # spot, swap, future
    margin_type: str = "isolated" # isolated, cross

class MLTrainRequest(BaseModel):
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    limit: int = 5000
    tp_multiplier: float = 2.0
    sl_multiplier: float = 2.0
    time_horizon: int = 10
    train_ratio: float = 0.8

# Training state
training_state = {
    "is_training": False,
    "progress": 0,
    "message": "",
    "model_path": None
}

# Training history (geçmiş eğitimler)
training_history = []

# Model metadata kaydetme
def save_training_metadata(symbol: str, timeframe: str, limit: int, metrics: dict, model_path: str):
    """Eğitim geçmişini JSON dosyasına kaydeder."""
    import json
    import os
    from datetime import datetime

    metadata = {
        "symbol": symbol,
        "timeframe": timeframe,
        "limit": limit,
        "trained_at": datetime.now().isoformat(),
        "model_path": model_path,
        "metrics": {
            "accuracy": metrics.get('accuracy', 0),
            "precision": metrics.get('precision', 0),
            "recall": metrics.get('recall', 0),
            "f1": metrics.get('f1', 0),
            "xgb_accuracy": metrics.get('xgb_accuracy', 0),
            "rf_accuracy": metrics.get('rf_accuracy', 0),
            "ensemble_accuracy": metrics.get('ensemble_accuracy', 0)
        }
    }

    training_history.append(metadata)

    # Dosyaya kaydet
    try:
        history_file = "artifacts/ml_training_history.json"
        os.makedirs(os.path.dirname(history_file), exist_ok=True)

        # Mevcut geçmişi yükle
        if os.path.exists(history_file):
            with open(history_file, 'r') as f:
                existing_history = json.load(f)
        else:
            existing_history = []

        # Yeni eğitimi ekle
        existing_history.append(metadata)

        # Sadece son 50 eğitimi sakla
        existing_history = existing_history[-50:]

        with open(history_file, 'w') as f:
            json.dump(existing_history, f, indent=2)
    except Exception as e:
        logger.error(f"Training metadata kaydedilemedi: {e}")

@app.post("/api/v1/strategy/select")
async def change_strategy(req: StrategySelectSchema):
    """Arayüzden gelen komutla botun beynini anında değiştirir."""
    from core.paper import paper_engine

    logger.info(f"📥 Strateji isteği alındı: symbol={req.symbol}, strategy_id={req.strategy_id or 'DURDUR'}")

    # Eğer sembol izlenmiyorsa ve strateji varsa başlat
    if req.symbol and req.strategy_id:
        await start_symbol_tasks(req.symbol, req.market_type, req.margin_type)
        # Mevcut izleniyorsa da tiplerini güncelle
        paper_engine.set_market_type(req.symbol, req.market_type)
        paper_engine.set_margin_type(req.symbol, req.margin_type)
        paper_engine.set_strategy(req.strategy_id, req.symbol, req.timeframe)
        logger.info(f"▶️ {req.symbol} için strateji başlatıldı: {req.strategy_id}")

    elif req.symbol and not req.strategy_id:
        # Strateji boş ise (durdurma), paper_engine'de temizle
        paper_engine.strategies[req.symbol] = None
        paper_engine.active_strategies[req.symbol] = ""
        logger.info(f"⏹️ {req.symbol} için strateji durduruldu. active_strategies[{req.symbol}]=''")
        logger.info(f"   paper_engine.strategies keys: {list(paper_engine.strategies.keys())}")
        logger.info(f"   paper_engine.active_strategies: {paper_engine.active_strategies}")

    return {
        "status": "success",
        "symbol": req.symbol if req.symbol else "GLOBAL",
        "active_id": req.strategy_id,
        "active_timeframe": req.timeframe,
        "market_type": req.market_type,
        "margin_type": req.margin_type
    }


@app.post("/api/v1/ml/train")
async def train_ml_model(req: MLTrainRequest):
    """
    Arayüzden ML modelini eğitir.
    Arka planda çalışır, ilerleme durumu /api/v1/ml/status endpoint'inden takip edilebilir.
    """
    global training_state

    if training_state["is_training"]:
        return {
            "status": "error",
            "message": "Eğitim zaten devam ediyor, lütfen bekleyin."
        }

    # Arka plan görevi olarak başlat
    asyncio.create_task(_run_ml_training(req))

    return {
        "status": "success",
        "message": f"ML modeli eğitimi başlatıldı ({req.symbol})...",
        "model_path": f"artifacts/models/xgb_model_{req.symbol.lower()}.json"
    }


async def _run_ml_training(req: MLTrainRequest):
    """Arka planda ML modelini eğitir."""
    global training_state

    try:
        training_state["is_training"] = True
        training_state["progress"] = 0
        training_state["message"] = "Veri çekiliyor..."

        logger.info("🧠 [ML] Eğitim başlatılıyor...")

        # 1. Veri çek (exchange'den)
        from data.indicators import StrategyIndicators
        from ml.model_training import run_training_pipeline
        from core.exchange import exchange_manager

        training_state["message"] = f"Veri çekiliyor: {req.symbol}, {req.timeframe}, {req.limit} mum..."
        training_state["progress"] = 10

        # Exchange'den OHLCV çek
        ohlcv_data = await exchange_manager.fetch_ohlcv(req.symbol, req.timeframe, req.limit)

        if not ohlcv_data or len(ohlcv_data) == 0:
            training_state["is_training"] = False
            training_state["message"] = "❌ Veri çekilemedi!"
            logger.error("❌ [ML] Veri çekilemedi!")
            return

        # DataFrame'e dönüştür
        import pandas as pd
        df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        df.set_index('timestamp', inplace=True)

        if df is None or len(df) == 0:
            training_state["is_training"] = False
            training_state["message"] = "❌ Veri çekilemedi!"
            logger.error("❌ [ML] Veri çekilemedi!")
            return

        training_state["message"] = f"İndikatörler hesaplanıyor ({len(df)} mum)..."
        training_state["progress"] = 30

        # 2. İndikatörleri ekle
        df = StrategyIndicators.add_all_indicators(df)

        training_state["message"] = "Model eğitiliyor..."
        training_state["progress"] = 50

        # 3. Model eğit
        model_path = f"artifacts/models/xgb_model_{req.symbol.lower()}.json"
        trainer = run_training_pipeline(
            df,
            model_save_path=model_path,
            tp_multiplier=req.tp_multiplier,
            sl_multiplier=req.sl_multiplier,
            time_horizon=req.time_horizon,
            train_ratio=req.train_ratio
        )

        training_state["progress"] = 90
        training_state["message"] = "Model kaydediliyor..."

        # 4. Modeli kaydet ve PaperTrader'a yükle
        from core.paper import paper_engine

        trainer.save_model(model_path)

        # Training metadata kaydet
        save_training_metadata(
            symbol=req.symbol,
            timeframe=req.timeframe,
            limit=req.limit,
            metrics=trainer.training_metrics,
            model_path=model_path
        )

        # PaperTrader'daki modeli güncelle
        if paper_engine.ml_model is not None:
            paper_engine.ml_model.load_model(model_path)
            logger.info("✅ [ML] PaperTrader modeli güncellendi!")
        else:
            logger.warning("⚠️ [ML] PaperTrader'da model yok, yeni model yüklendi.")

        training_state["is_training"] = False
        training_state["progress"] = 100
        training_state["message"] = f"✅ Eğitim tamamlandı! ({model_path})"
        training_state["model_path"] = model_path

        logger.info(f"✅ [ML] Eğitim başarıyla tamamlandı: {model_path}")

    except Exception as e:
        training_state["is_training"] = False
        training_state["message"] = f"❌ Eğitim hatası: {str(e)}"
        logger.error(f"❌ [ML] Eğitim hatası: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


@app.get("/api/v1/ml/status")
async def get_ml_training_status():
    """ML eğitim durumunu döner."""
    return {
        "status": "success",
        "training": training_state
    }


@app.get("/api/v1/ml/training-history")
async def get_ml_training_history():
    """Eğitilmiş ML modellerinin geçmişini döner."""
    import json
    import os

    # Dosyadan oku
    history_file = "artifacts/ml_training_history.json"
    if os.path.exists(history_file):
        try:
            with open(history_file, 'r') as f:
                history = json.load(f)
            return {
                "status": "success",
                "history": history
            }
        except Exception as e:
            logger.error(f"Training history okunamadı: {e}")

    # Dosya yoksa bellekten döner
    return {
        "status": "success",
        "history": training_history
    }

# ----------------------------------------------------------------------------------
# FRONTEND ARAYÜZ YAYINI (DASHBOARD)
# "frontend" klasörünün içindeki index.html web sitesini http://localhost:8000/ da açar.
# ----------------------------------------------------------------------------------
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
