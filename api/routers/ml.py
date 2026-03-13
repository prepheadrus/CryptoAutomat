"""
ML Router

FastAPI router for ML operations.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
import traceback
import calendar
from datetime import datetime

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


@router.get("/status", operation_id="get_ml_status")
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


@router.get("/visual-analysis")
async def run_visual_analysis(
    symbol: str,
    strategy_id: str,
    timeframe: str = "1h",
    limit: int = 1000
) -> Dict[str, Any]:
    """
    Görsel karar simülasyonu için mum verisi ve ML tahminlerini döner.
    
    Args:
        symbol: Sembol (örn: BTC/USDT)
        strategy_id: Strateji ID (örn: trend_master)
        timeframe: Zaman dilimi
        limit: Mum sayısı
    
    Returns:
        {
            "status": "success",
            "candles": [...],
            "markers": [...],
            "feature_importance": [...],
            "ml_predictions": [...]
        }
    """
    try:
        from data.database import db_manager
        import pandas as pd
        import numpy as np
        from data.indicators import StrategyIndicators
        
        logger.info(f"🔍 [ML] Görsel analiz başlatılıyor: {symbol} ({timeframe})")
        
        # 1. Veritabanından veri çek
        klines_data = await db_manager.get_klines(symbol, timeframe, limit=limit)
        
        if not klines_data or len(klines_data) == 0:
            raise HTTPException(status_code=404, detail=f"Veritabanında analiz için yeterli veri yok: {symbol} {timeframe}")

        df = pd.DataFrame(klines_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # [CRITICAL SYNC] Timestamp'i StrategyIndicators öncesi normalize et (1970 hatasını önlemek için)
        if 'timestamp' in df.columns and not df.empty:
            # Önce sayısal mı kontrol et
            ts_val = df['timestamp'].iloc[0]
            if isinstance(ts_val, (int, float, np.integer, np.floating)):
                if ts_val > 10**11: # Milisaniye (örn: 177xxxxxxxxx)
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                else: # Saniye (örn: 177xxxxxxx)
                    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s')
            else:
                # String (ISO) veya datetime objesi
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            
            # NaN temizliği (Geçersiz tarihler için)
            df = df.dropna(subset=['timestamp'])
        
        # [DEDUP] Kesin Deduplication (Data Integrity)
        df = df.drop_duplicates(subset=['timestamp'], keep='first')
        df = df.sort_values('timestamp').reset_index(drop=True)

        # 2. İndikatör ve Özellikleri Hesapla
        logger.info(f"📊 [ML] İndikatörler ve özellikler hesaplanıyor...")
        df = StrategyIndicators.add_all_indicators(df)
        
        # [SYNC] LWC için saniye formatına kesin zorla (int64)
        if 'timestamp' in df.columns:
            # Datetime'dan saniyeye (Pandas versiyonlarından bağımsız en güvenli yol)
            df['timestamp'] = ((df['timestamp'] - pd.Timestamp('1970-01-01')) // pd.Timedelta('1s')).astype('int64')
        
        # [DEBUG] Final veri aralığı kontrolü
        if not df.empty:
            logger.info(f"📊 [ML] Zaman damgası aralığı: {df['timestamp'].min()} - {df['timestamp'].max()}")
        
        # Gelecekte FeatureEngineer eklenebilmesi için placeholder
        try:
            from data.features import FeatureEngineer
            df = FeatureEngineer().add_all_features(df)
        except (ImportError, AttributeError):
            logger.debug("FeatureEngineer modülü bulunamadı, yalnızca indikatörler kullanılıyor.")
            
        logger.info(f"📊 [ML] İndikatörler hesaplandı: {df.shape[1]} kolon")

        # 3. Modeli Yükle ve Tahmin Yap
        model_info = ml_service.check_model(symbol, timeframe)
        markers = []
        feature_importance = []

        if model_info.get('model_exists'):
            from ml.model_training import ModelTrainer
            trainer = ModelTrainer()
            trainer.load_model(model_info['model_path'])
            
            # Modelin beklediği özellik isimlerini al
            model_feature_names = getattr(trainer.xgb_model, 'feature_names_in_', None)
            if model_feature_names is None:
                # Fallback for older xgboost versions or different model types
                model_feature_names = trainer.xgb_model.get_booster().feature_names

            if model_feature_names is None or len(model_feature_names) == 0:
                raise ValueError("Modelden özellik (feature) isimleri alınamadı.")

            # 4. Graceful Degradation: Eksik kolonları 0.0 ile doldur
            missing_cols = [col for col in model_feature_names if col not in df.columns]
            if missing_cols:
                logger.warning(f"⚠️ [ML] {len(missing_cols)} adet eksik kolon tespit edildi. 0.0 ile dolduruluyor: {missing_cols[:10]}...")
                for col in missing_cols:
                    df[col] = 0.0  # float64 olarak ekle

            # 5. Veriyi Temizle ve Tahmin için Hazırla
            X = df[model_feature_names].copy() # SettingWithCopyWarning önlemi (Copy)
            
            # SKILL.md Kuralı: NaN/Inf temizliği
            X.replace([np.inf, -np.inf], np.nan, inplace=True)
            X.fillna(0.0, inplace=True)

            # [XGBoost Tip Güvenliği Kalkanı] - Kesin Sayısal Veri (No datetime64)
            for col in X.columns:
                X[col] = pd.to_numeric(X[col], errors='coerce').astype(float)

            logger.info(f"📊 [ML] Tahmin yapılıyor: {len(X)} satır, {X.shape[1]} özellik")
            predictions = trainer.xgb_model.predict(X)
            logger.info(f"📊 [ML] Tahminler tamamlandı: {len(predictions)} adet, unique değerler: {np.unique(predictions)}")

            # Markers oluştur (Sadece değişim noktalarında ekle - Kalabalığı önlemek için)
            current_ml_state = None
            candles_since_last_ml = 0
            
            for i in range(len(predictions)): # Her mumu kontrol et, ama sadece state değiştiğinde marker bas
                if i < len(df):
                    pred_class = int(predictions[i])
                    ts = int(df['timestamp'].iloc[i])
                    
                    if pred_class == 1 and current_ml_state != 'LONG': # LONG Sinyali
                        markers.append({'time': ts, 'position': 'belowBar', 'color': '#2ea043', 'shape': 'arrowUp', 'text': 'ML AL', 'size': 0.6})
                        current_ml_state = 'LONG'
                        candles_since_last_ml = 0
                    elif pred_class == 0 and current_ml_state != 'SHORT': # SHORT Sinyali
                        markers.append({'time': ts, 'position': 'aboveBar', 'color': '#f85149', 'shape': 'arrowDown', 'text': 'ML SAT', 'size': 0.6})
                        current_ml_state = 'SHORT'
                        candles_since_last_ml = 0
                    else:
                        # Durum değişmedi, sayacı artır
                        candles_since_last_ml += 1
                        
                        # Eğer çok uzun süre aynı sinyal gittiyse (1000 mum) ufak bir hatırlatıcı bas (çok gürültü yapmadan)
                        if candles_since_last_ml >= 1000:
                            if current_ml_state == 'LONG':
                                markers.append({'time': ts, 'position': 'belowBar', 'color': 'rgba(46, 160, 67, 0.4)', 'shape': 'arrowUp', 'text': 'ML AL (DVM)', 'size': 0.3})
                            elif current_ml_state == 'SHORT':
                                markers.append({'time': ts, 'position': 'aboveBar', 'color': 'rgba(248, 81, 73, 0.4)', 'shape': 'arrowDown', 'text': 'ML SAT (DVM)', 'size': 0.3})
                            candles_since_last_ml = 0

            
            # Feature importance al
            try:
                feature_importance = trainer.get_feature_importance_df(top_n=10).to_dict('records')
            except Exception as e:
                logger.warning(f"⚠️ [ML] Feature importance alınamadı: {e}")

        else:
            logger.warning(f"⚠️ [ML] Aktif model bulunamadı: {symbol} {timeframe}")

        # 5.5 Strateji Sinyallerini Hesapla (Karşılaştırma için Mor Sinyaller)
        try:
            from strategy.manager import StrategyManager
            strategy = StrategyManager.get_strategy(strategy_id)
            
            current_strat_state = None
            is_executor = hasattr(strategy, 'config')
            
            for i in range(10, len(df)):  # İndikatörlerin oturması için 10 mum bekle
                sig = 1
                try:
                    if is_executor:
                        sig = strategy.generate_signal(df.iloc[:i+1])
                    elif hasattr(strategy, 'generate_signal'):
                        sig = strategy.generate_signal(df.iloc[i])
                except Exception:
                    pass
                
                # Sadece pozisyon değişimlerinde marker ekle (AL'dan sonra tekrar AL basma)
                if sig == 2 and current_strat_state != 'LONG':
                    ts = int(df['timestamp'].iloc[i])
                    markers.append({'time': ts, 'position': 'belowBar', 'color': '#bc8cff', 'shape': 'circle', 'text': 'S.AL', 'size': 0.7})
                    current_strat_state = 'LONG'
                elif sig == 0 and current_strat_state != 'SHORT':
                    ts = int(df['timestamp'].iloc[i])
                    markers.append({'time': ts, 'position': 'aboveBar', 'color': '#bc8cff', 'shape': 'circle', 'text': 'S.SAT', 'size': 0.7})
                    current_strat_state = 'SHORT'
                
        except Exception as e:
            logger.warning(f"⚠️ [ML] Strateji (karşılaştırma) sinyalleri hesaplanamadı: {e}")

        # 5.6 Gerçek İşlemleri Ekle (Bot çalıştığında gelen "GERÇEK AL / GERÇEK SAT")
        try:
            from core.paper import paper_engine
            current_real_state = None
            
            # Tüm gerçek işlemleri (Açık ve Kapalı) tek bir zaman çizelgesinde birleştir
            all_real_trades = []
            
            # Kapanmış işlemler (trade_history / legacy_positions karması)
            for trade in paper_engine.trade_history:
                if trade.get('symbol') == symbol:
                    all_real_trades.append({
                        'time': trade.get('opened_at') or trade.get('entry_time'),
                        'type': trade.get('direction') or trade.get('type') or trade.get('action'),
                        'status': 'closed',
                        'close_time': trade.get('closed_at') or trade.get('exit_time')
                    })
                    
            # Açık pozisyonlar
            for pos in paper_engine.open_positions:
                if pos.get('symbol') == symbol:
                    all_real_trades.append({
                        'time': pos.get('opened_at') or pos.get('entry_time'),
                        'type': pos.get('direction') or pos.get('type') or pos.get('action'),
                        'status': 'open'
                    })
            
            # Zamanına göre sırala
            all_real_trades = [t for t in all_real_trades if t['time'] is not None]
            
            # DataFrame'in en küçük/en büyük zamanlarını al
            if not df.empty and all_real_trades:
                # Timestampları saniyeye çevirme yardımcı fonksiyonu
                def parse_timestamp(t):
                    try:
                        t_obj = pd.to_datetime(t)
                        return int(t_obj.timestamp())
                    except:
                        return 0
                        
                # Gerçek işlemleri DataFrame'deki en yakın muma eşle (aynı mantık)
                for trade in all_real_trades:
                    trade_time = parse_timestamp(trade['time'])
                    trade_type = str(trade['type']).upper()
                    
                    # LONG/BUY mantığı
                    if trade_type in ['LONG', 'BUY'] and current_real_state != 'LONG':
                        markers.append({'time': trade_time, 'position': 'belowBar', 'color': '#00FA9A', 'shape': 'circle', 'text': 'GERÇEK AL', 'size': 1.0})
                        current_real_state = 'LONG'
                        
                    # SHORT/SELL mantığı
                    elif trade_type in ['SHORT', 'SELL'] and current_real_state != 'SHORT':
                        markers.append({'time': trade_time, 'position': 'aboveBar', 'color': '#FF4500', 'shape': 'circle', 'text': 'GERÇEK SAT', 'size': 1.0})
                        current_real_state = 'SHORT'
                        
                    # Kapanış için ekstra marker
                    if trade.get('status') == 'closed' and trade.get('close_time'):
                        close_time = parse_timestamp(trade['close_time'])
                        markers.append({'time': close_time, 'position': 'aboveBar', 'color': '#FFFFFF', 'shape': 'circle', 'text': 'İŞLEM KAPANIŞ', 'size': 0.8})
                        current_real_state = None  # Pozisyon kapandığı için durumu sıfırla
                        
        except Exception as e:
            logger.warning(f"⚠️ [ML] Gerçek işlemler hesaplanamadı/eklenemedi: {e}")

        # 6. Candlestick verisini hazırla
        # [INTEGRITY] Candlestick verisini temizle ve LWC için hazırla
        candles_df = df[['timestamp', 'open', 'high', 'low', 'close']].copy()
        candles_df = candles_df.rename(columns={'timestamp': 'time'})
        
        # Kesin sayısal tip zorlaması (Crash önlemi)
        for col in ['open', 'high', 'low', 'close']:
            candles_df[col] = pd.to_numeric(candles_df[col], errors='coerce').fillna(0).astype(float)
        
        candles_df = candles_df.dropna(subset=['time'])
        candles_df = candles_df.drop_duplicates(subset=['time'])
        candles_df = candles_df.sort_values('time')
        
        # [SYNC] LWC için saniye formatına kesin zorla (int)
        candles_df['time'] = candles_df['time'].astype('int64')
        
        candles = candles_df.to_dict('records')
        
        logger.info(f"✅ [ML] Görsel analiz tamamlandı: {len(candles)} mum, {len(markers)} marker")

        return {
            "status": "success",
            "candles": candles,
            "markers": markers,
            "feature_importance": feature_importance,
        }
        
    except Exception as e:
        logger.error(f"❌ [ML] Görsel analiz sırasında kritik hata: {e}")
        logger.error(f"❌ [ML] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Görsel analiz hatası: {str(e)}")
