"""
ML Service

Business logic for ML operations.
"""

from typing import Dict, Any, List, Optional
import asyncio
import os
import json
import traceback
from datetime import datetime, timedelta

from core.logger import logger
from api.schemas.ml import MLTrainRequest


class MLService:
    """
    ML Service.

    Business logic for ML operations:
    - Train model
    - Get training status
    - Get training history
    - Check model
    """

    def __init__(self):
        self.training_state = {
            "is_training": False,
            "progress": 0,
            "message": "",
            "current_step": ""
        }
        self.training_history = []

    async def train_model(self, request: MLTrainRequest) -> Dict[str, Any]:
        """
        ML model eğit.

        Args:
            request: ML eğitim isteği

        Returns:
            Eğitim yanıtı (BEKLEYEN - training bitene kadar dönmez)
        """
        if self.training_state["is_training"]:
            return {
                "status": "error",
                "message": "Training is already in progress, please wait."
            }

        # ÖNEMLİ: Arka plan görevi olarak başlatma - BEKLE!
        # Kullanıcı UI'da "tamamlandı" görmeden eğitim bitsin
        return await self._run_training(request)

    async def _run_training(self, request: MLTrainRequest):
        """Arka planda ML modelini eğitir. YENİ: Resampling mimarisi ile."""
        start_time = datetime.now()
        try:
            self.training_state["is_training"] = True
            self.training_state["progress"] = 5
            self.training_state["message"] = "Veri çekiliyor..."
            self.training_state["current_step"] = "Parquet Lake + Smart Cache"

            logger.info(f"🧠 [ML] Starting ML training: {request.symbol} ({request.timeframe}) - {request.limit} candles")

            # ========================================================================
            # 🏗️ PARQUET DATA LAKE - SMART CACHE
            # ========================================================================
            # 1. Önce Parquet gölünden yükle (vektörize okuma)
            # 2. Eksik varsa SQLite'dan tamamla (1m + resample)
            # 3. UTC timezone sync + NaN temizliği (Infinity koruması)
            # ========================================================================

            from api.services.data_service import DataService
            import pytz

            data_service = DataService()

            # Tarih aralığı hesapla - KULLANICI LIMIT'İNE GÖRE
            # 1m timeframe için: limit * 1 dakika
            # Kullanıcı 100K mum istiyorsa, tam olarak 100K mum çek
            end_date = datetime.now(tz=pytz.UTC)

            # Timeframe'e göre dakika hesaplama
            tf_minutes = {
                '1m': 1, '3m': 3, '5m': 5, '10m': 10, '15m': 15,
                '20m': 20, '30m': 30, '45m': 45, '1h': 60, '2h': 120,
                '3h': 180, '4h': 240, '6h': 360, '8h': 480, '12h': 720,
                '1d': 1440, '1w': 10080
            }
            minutes_per_candle = tf_minutes.get(request.timeframe, 1)

            # İstenen mum sayısı kadar geriye git
            total_minutes = request.limit * minutes_per_candle
            start_date = end_date - timedelta(minutes=total_minutes)

            logger.info(f"🏗️ [PARQUET LAKE] Loading data for {request.symbol} {request.timeframe}...")
            logger.info(f"📅 [TIME RANGE] {start_date} - {end_date} ({request.limit} candles, ~{total_minutes} minutes)")

            # SMART CACHE köprü fonksiyonu
            df = await data_service.get_cached_or_fetch_data(
                symbol=request.symbol,
                timeframe=request.timeframe,
                start_date=start_date,
                end_date=end_date
            )

            if df is None or len(df) == 0:
                raise ValueError(f"Insufficient data in Parquet Lake: {request.symbol} {request.timeframe}")

            # DataFrame'i ML formatına hazırla
            import pandas as pd

            # UTC timezone kontrolü (leakage koruması)
            if df.index.tz is None:
                df.index = df.index.tz_localize('UTC')
            elif df.index.tz != pytz.UTC:
                df.index = df.index.tz_convert('UTC')

            # NaN/Infinity temizliği (XGBoost crash koruması)
            df = df.replace([float('inf'), float('-inf')], float('nan'))
            df = df.ffill().dropna(how='all')

            # ⚠️ ÖNEMLİ: Kullanıcı limit'ini uygula
            # Data service fazla veri dönmüş olabilir, son N mumu al
            if len(df) > request.limit:
                logger.info(f"✂️ [LIMIT] {len(df)} candles found, using last {request.limit} candles")
                df = df.tail(request.limit)

            logger.info(f"✅ [PARQUET LAKE] {request.symbol} {request.timeframe} → {len(df)} candles loaded (limit: {request.limit})")
            logger.info(f"📊 [PARQUET LAKE] First: {df.index[0]}, Last: {df.index[-1]}")
            logger.info(f"🛡️ [ML] NaN clean: UTC sync + ffill + dropna applied")

            # Final log
            logger.info("🎉 [DATA LAKE] Full transition to Parquet Engine active with risk guards")
            
            self.training_state["progress"] = 30
            self.training_state["message"] = "Feature engineering ve etiketleme yapılıyor..."
            self.training_state["current_step"] = "ML pipeline"
            
            logger.info(f"📊 [ML] Starting ML pipeline...")
            
            # --- YENİ EKLENEN: ML İÇİN TEKNİK İNDİKATÖR HESAPLAMASI ---
            from data.indicators import StrategyIndicators
            logger.info("🧠 [ML FEATURE ENGINEERING] Adding 20+ technical indicators (RSI, MACD, OBV, etc.)...")
            df = StrategyIndicators.add_all_indicators(df)
            df = df.dropna()
            logger.info(f"✅ [ML FEATURE ENGINEERING] Indicators successfully added, features ready for training.")
            # ----------------------------------------------------------
            
            # 2-3. Feature engineering + Triple Barrier + Train/test split (hepsi bir arada)
            from ml.data_prep import prepare_ml_data
            X_train, X_test, y_train, y_test, scaler = prepare_ml_data(
                df,
                tp_multiplier=request.tp,
                sl_multiplier=request.sl,
                time_horizon=10,
                skip_barrier=False  # Triple Barrier uygula
            )
            
            logger.info(f"✅ [ML] ML pipeline complete: {X_train.shape[0]} train, {X_test.shape[0]} test samples")
            
            # 4. Model eğit
            self.training_state["progress"] = 70
            self.training_state["message"] = "XGBoost modeli eğitiliyor..."
            self.training_state["current_step"] = "Model training"
            
            from ml.model_training import ModelTrainer
            trainer = ModelTrainer(
                n_estimators=500,
                max_depth=6,
                learning_rate=0.1,
                subsample=0.8,
                colsample_bytree=0.8
            )
            
            # Modeli eğit (train metodu kullan)
            training_metrics = trainer.train(X_train, y_train, X_test, y_test)
            
            logger.info(f"✅ [ML] Model trained successfully")
            logger.info(f"📊 [ML] Training metrics: {training_metrics}")
            
            # 6. Modeli kaydet
            self.training_state["progress"] = 85
            self.training_state["message"] = "Model kaydediliyor..."
            self.training_state["current_step"] = "Save model"

            # Merkezi path generator fonksiyonunu kullan
            from ml.model_training import get_model_paths
            model_paths = get_model_paths(request.symbol, request.timeframe)

            # Model dizinini oluştur
            os.makedirs("artifacts/models", exist_ok=True)

            # Ensemble modelleri kaydet (XGBoost + RF + Metadata)
            trainer.save_model(
                model_path=model_paths['xgboost_path'],
                timeframe=request.timeframe
            )

            logger.info(f"💾 [ML] Ensemble models saved:")
            logger.info(f"   XGBoost: {model_paths['xgboost_path']}")
            logger.info(f"   RF:      {model_paths['rf_path']}")
            logger.info(f"   Meta:    {model_paths['metadata_path']}")

            # 7. Eğitim geçmişini güncelle
            self.training_state["progress"] = 95
            self.training_state["message"] = "Geçmiş güncelleniyor..."
            self.training_state["current_step"] = "Update history"

            self._save_training_history(
                request,
                model_paths['xgboost_path'],  # XGBoost ana model yolunu kaydet
                X_train.shape[0] + X_test.shape[0],  # Toplam örnek sayısı
                X_train.shape[1],  # Feature sayısı
                training_metrics,  # Eğitim metrikleri
                start_time
            )

            # 8. Tamamlandı
            self.training_state["is_training"] = False
            self.training_state["progress"] = 100
            self.training_state["message"] = f"✅ ML eğitimi tamamlandı: {request.symbol}"
            self.training_state["current_step"] = "Completed"

            logger.info(f"🎉 [ML] ML training completed successfully: {request.symbol}")

            # ⚠️ ÖNEMLİ: Tüm NumPy tiplerini Python native tiplerine çevir (Pydantic JSON serialization)
            import numpy as np

            def convert_numpy_types(obj):
                """Recursively convert numpy types to native Python types."""
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                elif isinstance(obj, (np.int8, np.int16, np.int32, np.int64, np.integer)):
                    return int(obj)
                elif isinstance(obj, (np.float16, np.float32, np.float64, np.floating)):
                    return float(obj)
                elif isinstance(obj, dict):
                    return {k: convert_numpy_types(v) for k, v in obj.items()}
                elif isinstance(obj, (list, tuple)):
                    return [convert_numpy_types(item) for item in obj]
                return obj

            metrics_for_response = convert_numpy_types(training_metrics)

            # Başarı yanıtı dön
            return {
                "status": "success",
                "message": f"ML model trained successfully ({request.symbol})",
                "model_path": model_paths['xgboost_path'],
                "metrics": metrics_for_response,
                "dataset_size": int(X_train.shape[0] + X_test.shape[0]),
                "accuracy": float(training_metrics.get('metrics', {}).get('accuracy', 0) * 100)
            }

        except Exception as e:
            logger.error(f"❌ [ML] Training error: {e}")
            logger.error(f"❌ [ML] Traceback: {traceback.format_exc()}")
            self.training_state["is_training"] = False
            self.training_state["message"] = f"Error: {str(e)}"
            self.training_state["current_step"] = "Error"

            # Hata yanıtı dön
            return {
                "status": "error",
                "message": str(e)
            }

    def _save_training_history(self, request: MLTrainRequest, model_path: str, dataset_size: int, feature_count: int, training_metrics: dict = None, start_time: datetime = None):
        """Eğitim geçmişini kaydet."""
        try:
            history_file = "artifacts/ml_training_history.json"
            os.makedirs("artifacts", exist_ok=True)

            # Training metrics'den TÜM metrikleri al
            accuracy = 0.0
            precision = 0.0
            recall = 0.0
            f1_score = 0.0
            xgb_accuracy = 0.0
            rf_accuracy = 0.0
            ensemble_accuracy = 0.0

            if training_metrics:
                # metrics dict'unun iç yapısını kullan
                metrics = training_metrics.get('metrics', {})
                accuracy = float(metrics.get('accuracy', 0.0))
                precision = float(metrics.get('precision', 0.0))
                recall = float(metrics.get('recall', 0.0))
                f1_score = float(metrics.get('f1', 0.0))
                xgb_accuracy = float(metrics.get('xgb_accuracy', accuracy))
                rf_accuracy = float(metrics.get('rf_accuracy', accuracy))
                ensemble_accuracy = float(metrics.get('ensemble_accuracy', accuracy))

            # Duration hesapla
            completed_at = datetime.now()
            started_at = start_time if start_time else completed_at
            duration_seconds = (completed_at - started_at).total_seconds()

            # Yeni kayıt - TÜM METRKLERİ KAYDET
            new_entry = {
                "training_id": f"{request.symbol}_{request.timeframe}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "model_type": request.model_type,
                "dataset_size": dataset_size,
                "feature_count": feature_count,
                "tp_multiplier": float(getattr(request, 'tp', 2.0)),
                "sl_multiplier": float(getattr(request, 'sl', 2.0)),
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_seconds": duration_seconds,
                "metrics": {
                    "accuracy": accuracy,
                    "precision": precision,
                    "recall": recall,
                    "f1": f1_score,
                    "xgb_accuracy": xgb_accuracy,
                    "rf_accuracy": rf_accuracy,
                    "ensemble_accuracy": ensemble_accuracy
                },
                "model_path": model_path
            }

            # Mevcut geçmişi yükle
            history = []
            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    history = json.load(f)

            # Yeni kaydı ekle
            history.append(new_entry)

            # Son 100 kaydı sakla
            history = history[-100:]

            # Kaydet
            with open(history_file, 'w') as f:
                json.dump(history, f, indent=2)

            logger.info(f"📝 [ML] Training history updated: {len(history)} records")
            logger.info(f"📊 [ML] Metrics saved: Acc={accuracy:.4f}, Prec={precision:.4f}, Rec={recall:.4f}, F1={f1_score:.4f}")
            logger.info(f"📊 [ML] Model Acc: XGB={xgb_accuracy:.4f}, RF={rf_accuracy:.4f}, Ens={ensemble_accuracy:.4f}")

        except Exception as e:
            logger.error(f"❌ [ML] History save error: {e}")
            logger.error(f"❌ [ML] Traceback: {traceback.format_exc()}")

    def get_training_status(self) -> Dict[str, Any]:
        """
        Eğitim durumunu al.

        Returns:
            Eğitim durumu
        """
        return {
            "status": "success",
            **self.training_state
        }

    def get_training_history(self, limit: int = 50) -> Dict[str, Any]:
        """
        Eğitim geçmişini al.

        Args:
            limit: Maksimum kayıt sayısı

        Returns:
            Eğitim geçmişi
        """
        try:
            history_file = "artifacts/ml_training_history.json"

            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    history = json.load(f)
                return {
                    "status": "success",
                    "history": history[-limit:],
                    "total": len(history)
                }

            return {
                "status": "success",
                "history": [],
                "total": 0
            }

        except Exception as e:
            logger.error(f"Training history error: {e}")
            return {"status": "error", "message": str(e)}

    def delete_training_history(self) -> Dict[str, Any]:
        """
        Eğitim geçmişini sil.

        Returns:
            Silme yanıtı
        """
        try:
            history_file = "artifacts/ml_training_history.json"

            if os.path.exists(history_file):
                os.remove(history_file)
                self.training_history = []

            return {"status": "success", "message": "Training history cleared successfully"}

        except Exception as e:
            logger.error(f"History deletion error: {e}")
            return {"status": "error", "message": str(e)}

    def delete_model(self, symbol: str, timeframe: str) -> Dict[str, Any]:
        """
        Belirli bir ML modelini sil.

        Args:
            symbol: Sembol (örn: BTC/USDT)
            timeframe: Zaman dilimi (örn: 1h)

        Returns:
            Silme yanıtı
        """
        try:
            from ml.model_training import get_model_paths

            # Model yollarını al
            model_paths = get_model_paths(symbol, timeframe)

            # Silinecek dosyalar
            deleted_files = []
            errors = []

            for file_path in [model_paths['xgboost_path'], model_paths['rf_path'], model_paths['metadata_path']]:
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        deleted_files.append(file_path)
                        logger.info(f"✅ [ML] Model file deleted: {file_path}")
                    except Exception as e:
                        errors.append(f"{file_path}: {str(e)}")
                        logger.error(f"❌ [ML] File deletion error: {file_path} - {e}")

            # Training history'den de sil (eğer varsa)
            history_deleted = False
            try:
                history_file = "artifacts/ml_training_history.json"
                if os.path.exists(history_file):
                    with open(history_file, 'r') as f:
                        history = json.load(f)

                    # Bu modele ait kayıtları filtrele
                    original_count = len(history)
                    history = [
                        h for h in history
                        if not (h.get('symbol') == symbol and h.get('timeframe') == timeframe)
                    ]

                    # Güncellenmiş history'yi kaydet
                    with open(history_file, 'w') as f:
                        json.dump(history, f, indent=2)

                    if len(history) < original_count:
                        history_deleted = True
                        logger.info(f"✅ [ML] Deleted {original_count - len(history)} records from training history")
            except Exception as e:
                logger.warning(f"⚠️ [ML] History deletion error: {e}")

            if deleted_files or history_deleted:
                return {
                    "status": "success",
                    "message": f"{len(deleted_files)} files and history records deleted" if history_deleted else f"{len(deleted_files)} model files deleted",
                    "deleted_files": deleted_files,
                    "errors": errors if errors else None
                }
            else:
                return {
                    "status": "error",
                    "message": "No model files found to delete",
                    "errors": errors
                }

        except Exception as e:
            logger.error(f"Model deletion error: {e}")
            return {"status": "error", "message": str(e)}

    def check_model(self, symbol: str, timeframe: str) -> Dict[str, Any]:
        """
        Model varlığını kontrol et.

        Args:
            symbol: Sembol
            timeframe: Zaman dilimi

        Returns:
            Model kontrol yanıtı
        """
        # Merkezi path generator fonksiyonunu kullan
        from ml.model_training import get_model_paths
        model_paths = get_model_paths(symbol, timeframe)

        # Tüm model dosyalarının varlığını kontrol et
        xgb_exists = os.path.exists(model_paths['xgboost_path'])
        rf_exists = os.path.exists(model_paths['rf_path'])
        metadata_exists = os.path.exists(model_paths['metadata_path'])

        return {
            "status": "success",
            "model_exists": xgb_exists,
            "model_path": model_paths['xgboost_path'] if xgb_exists else None,
            "message": "Model found" if xgb_exists else "Model not found",
            "ensemble_status": {
                "xgboost": xgb_exists,
                "random_forest": rf_exists,
                "metadata": metadata_exists,
                "full_ensemble": xgb_exists and rf_exists and metadata_exists
            }
        }
