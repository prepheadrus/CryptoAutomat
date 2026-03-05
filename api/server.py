from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, Any

from core.logger import logger
from core.config import CONFIG
from data.database import db_manager
from core.exchange import exchange_manager
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

@app.on_event("startup")
async def startup_event():
    # Arka planda botun asıl döngüsünü engellemeden çalıştır
    asyncio.create_task(start_bot_tasks())

@app.on_event("shutdown")
async def shutdown_event():
    await shutdown_bot_tasks()

# --- API UÇ NOKTALARI (ENDPOINTS) ARAYÜZ İÇİN ---

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
    symbol = data.get("symbol")
    timeframe = data.get("timeframe", "1m")
    start_date = data.get("start_date", "2024-01-01")
    market_type = data.get("market_type", "future")
    
    if not symbol:
        return {"status": "error", "message": "Sembol belirtilmedi."}
    
    if symbol in exchange_manager.active_downloads:
        task = exchange_manager.active_downloads[symbol]
        return {
            "status": "exists", 
            "message": f"{symbol} için zaten bir kayıt ({task['status'].upper()}) bulunuyor.",
            "task": task
        }
    
    # Arka planda indirmeyi başlat
    background_tasks.add_task(exchange_manager.download_historical_data, symbol, timeframe, start_date, market_type)
    
    return {
        "status": "started",
        "message": f"{symbol} ({market_type}) için {start_date} tarihinden itibaren veri indirme görevi başlatıldı."
    }

@app.post("/api/v1/data/stop-download")
async def stop_historical_download(data: Dict[str, str]):
    """Devam eden indirme işlemini durdurur."""
    symbol = data.get("symbol")
    if symbol in exchange_manager.active_downloads:
        exchange_manager.download_stops[symbol] = True
        return {"status": "success", "message": f"{symbol} durdurma sinyali gönderildi."}
    
    # Eğer RAM'de yok ama DB'de 'running' görünüyorsa ona da stop çekelim (Ender durum)
    exchange_manager.download_stops[symbol] = True
    return {"status": "success", "message": f"{symbol} için genel durdurma sinyali gönderildi."}

@app.post("/api/v1/data/resume-download")
async def resume_historical_download(data: Dict[str, str], background_tasks: BackgroundTasks):
    """Durdurulmuş veya tamamlanmış indirme işlemini kaldığı yerden yeniden başlatır."""
    symbol = data.get("symbol")
    
    # RAM'de yoksa ama DB'de varsa, RAM'e yükle ki is_resume çalışsın
    if symbol not in exchange_manager.active_downloads:
        tasks = await db_manager.get_all_download_tasks()
        task_db = next((t for t in tasks if t['symbol'] == symbol), None)
        if task_db:
            exchange_manager.active_downloads[symbol] = dict(task_db)
            
    if symbol in exchange_manager.active_downloads:
        task = exchange_manager.active_downloads[symbol]
        task['status'] = 'running'
        exchange_manager.download_stops[symbol] = False
        exchange_manager.download_pauses[symbol] = False
        
        # Kaldığı yerden devam etmesini söyle: is_resume=True
        background_tasks.add_task(
            exchange_manager.download_historical_data, 
            symbol, task['timeframe'], task['start_date'], task['market_type'], is_resume=True
        )
        return {"status": "success", "message": f"{symbol} kaldığı yerden devam ediyor."}
        
    return {"status": "error", "message": "Görev bulunamadı. Yeni bir görev başlatın."}

@app.get("/api/v1/data/active-downloads")
async def get_active_downloads():
    """Tüm indirme görevlerini (aktif, durdurulmuş, tamamlanmış) veritabanından ve hafızadan listeler."""
    # 1. RAM'deki ve DB'deki indirme görevlerini al
    db_tasks = await db_manager.get_all_download_tasks()
    task_map = {t['symbol']: dict(t) for t in db_tasks}
    
    for s, meta in exchange_manager.active_downloads.items():
        task_map[s] = meta
        
    # 2. Önemli: DB'de klines verisi olan ama görev listesinde olmayanları da ekle
    data_symbols = await db_manager.get_symbols_with_data()
    for s in data_symbols:
        if s not in task_map:
            # Gerçek tarih aralığını veritabanından sorgula (Daha profesyonel görünüm)
            candle_range = await db_manager.get_candle_range(s)
            
            # Market tipini tahmin et veya bul
            guessed_type = 'spot'
            if ':' in s or '/USDT' not in s: # Heuristic: Suffix veya farklı baz
                guessed_type = 'future'
            
            # Eğer borsa yüklüyse ve sembol oradaysa garantile
            if exchange_manager.exchange.markets and s in exchange_manager.exchange.markets:
                m = exchange_manager.exchange.markets[s]
                guessed_type = (m.get('type') or 'spot').lower()

            # Eksik görev kaydı oluştur (Mevcut veriyi yansıt)
            task_map[s] = {
                'symbol': s,
                'status': 'completed',
                'timeframe': '1m', 
                'market_type': guessed_type,
                'start_date': None, # formatTs'e bırakacağız
                'target_start_ms': candle_range['start'] if candle_range else 0,
                'current_ts': candle_range['end'] if candle_range else 0,
                'is_orphaned': True 
            }
            
    return task_map

@app.post("/api/v1/data/delete-task")
async def delete_download_task(data: Dict[str, Any]):
    """Görevi (ve isteğe bağlı olarak verilerini) tamamen siler."""
    symbol = data.get("symbol")
    with_data = data.get("with_data", False) # Verileri de silsin mi?

    # 1. Eğer çalışıyorsa önce durdurma sinyali gönder
    exchange_manager.download_stops[symbol] = True
    
    # 2. RAM'den temizle
    if symbol in exchange_manager.active_downloads:
        del exchange_manager.active_downloads[symbol]
        
    # 3. Veritabanından görev kaydını sil
    await db_manager.delete_download_task(symbol)
    
    # 4. Eğer kullanıcı verileri de silmek istediyse
    if with_data:
        await db_manager.delete_klines_for_symbol(symbol)
        return {"status": "success", "message": f"{symbol} görevi ve tüm geçmiş verileri başarıyla silindi."}

    return {"status": "success", "message": f"{symbol} görev kaydı silindi (Veriler korundu)."}

@app.post("/api/v1/data/toggle-pause")
async def toggle_pause_download(data: Dict[str, str]):
    """İndirme işlemini duraklatır veya devam ettirir."""
    symbol = data.get("symbol")
    if symbol in exchange_manager.active_downloads:
        current_state = exchange_manager.download_pauses.get(symbol, False)
        exchange_manager.download_pauses[symbol] = not current_state
        return {
            "status": "success", 
            "paused": not current_state,
            "message": f"{symbol} {'duraklatıldı' if not current_state else 'devam ettiriliyor'}."
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
                if sig == 2 and m_idx == 2 and m_cnf >= threshold and not htf_bear:
                    actual_trades.append({"timestamp": ts, "action": "LONG_ENTER", "price": close_p})
                    in_trade = True
                    trade_dir = "LONG"
                elif sig == 0 and m_idx == 0 and m_cnf >= threshold and not htf_bull:
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

@app.post("/api/v1/strategy/select")
async def change_strategy(req: StrategySelectSchema):
    """Arayüzden gelen komutla botun beynini anında değiştirir."""
    # Eğer sembol izlenmiyorsa başlat
    if req.symbol:
        await start_symbol_tasks(req.symbol, req.market_type, req.margin_type)
        # Mevcut izleniyorsa da tiplerini güncelle
        paper_engine.set_market_type(req.symbol, req.market_type)
        paper_engine.set_margin_type(req.symbol, req.margin_type)
        
    paper_engine.set_strategy(req.strategy_id, req.symbol, req.timeframe)
    return {
        "status": "success",
        "symbol": req.symbol if req.symbol else "GLOBAL",
        "active_id": req.strategy_id,
        "active_timeframe": req.timeframe,
        "market_type": req.market_type,
        "margin_type": req.margin_type
    }

# ----------------------------------------------------------------------------------
# FRONTEND ARAYÜZ YAYINI (DASHBOARD)
# "frontend" klasörünün içindeki index.html web sitesini http://localhost:8000/ da açar.
# ----------------------------------------------------------------------------------
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
