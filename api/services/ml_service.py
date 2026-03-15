"""
ML Service

Business logic for ML operations.
"""

from typing import Dict, Any, List, Optional
import asyncio
import os
import json
import traceback
from datetime import datetime

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
            Eğitim başlatma yanıtı
        """
        if self.training_state["is_training"]:
            return {
                "status": "error",
                "message": "Eğitim zaten devam ediyor, lütfen bekleyin."
            }

        # Arka plan görevi olarak başlat
        asyncio.create_task(self._run_training(request))

        # Merkezi path generator fonksiyonunu kullan
        from ml.model_training import get_model_paths
        model_paths = get_model_paths(request.symbol, request.timeframe)

        return {
            "status": "success",
            "message": f"ML modeli eğitimi başlatıldı ({request.symbol})...",
            "model_path": model_paths['xgboost_path']
        }

    async def _run_training(self, request: MLTrainRequest):
        """Arka planda ML modelini eğitir. YENİ: Resampling mimarisi ile."""
        try:
            self.training_state["is_training"] = True
            self.training_state["progress"] = 5
            self.training_state["message"] = "Veri çekiliyor..."
            self.training_state["current_step"] = "Parquet Lake + Smart Cache"

            logger.info(f"🧠 [ML] Eğitim başlatılıyor: {request.symbol} ({request.timeframe}) - {request.limit} mum")

            # ========================================================================
            # 🏗️ PARQUET DATA LAKE - SMART CACHE
            # ========================================================================
            # 1. Önce Parquet gölünden yükle (vektörize okuma)
            # 2. Eksik varsa SQLite'dan tamamla (1m + resample)
            # 3. UTC timezone sync + NaN temizliği (Infinity koruması)
            # ========================================================================

            from api.services.data_service import DataService
            from datetime import datetime, timedelta
            import pytz

            data_service = DataService()

            # Tarih aralığı hesapla
            end_date = datetime.now(tz=pytz.UTC)
            start_date = end_date - timedelta(minutes=request.limit * 2)  # %50 buffer

            logger.info(f"🏗️ [PARQUET LAKE] {request.symbol} {request.timeframe} için veri yükleniyor...")

            # SMART CACHE köprü fonksiyonu
            df = await data_service.get_cached_or_fetch_data(
                symbol=request.symbol,
                timeframe=request.timeframe,
                start_date=start_date,
                end_date=end_date
            )

            if df is None or len(df) == 0:
                raise ValueError(f"Parquet Lake'te yeterli veri yok: {request.symbol} {request.timeframe}")

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

            logger.info(f"✅ [PARQUET LAKE] {request.symbol} {request.timeframe} → {len(df)} mum yüklendi")
            logger.info(f"📊 [PARQUET LAKE] İlk: {df.index[0]}, Son: {df.index[-1]}")
            logger.info(f"🛡️ [ML] NaN temizliği: UTC sync + ffill + dropna uygulandı")

            # Final log
            logger.info("🎉 [DATA LAKE] Parquet Engine'e Tam Geçiş Sağlandı ve Risk Kalkanları Aktif")
            
            self.training_state["progress"] = 30
            self.training_state["message"] = "Feature engineering ve etiketleme yapılıyor..."
            self.training_state["current_step"] = "ML pipeline"
            
            logger.info(f"📊 [ML] ML pipeline başlatılıyor...")
            
            # 2-3. Feature engineering + Triple Barrier + Train/test split (hepsi bir arada)
            from ml.data_prep import prepare_ml_data
            X_train, X_test, y_train, y_test, scaler = prepare_ml_data(
                df,
                tp_multiplier=request.tp,
                sl_multiplier=request.sl,
                time_horizon=10,
                skip_barrier=False  # Triple Barrier uygula
            )
            
            logger.info(f"✅ [ML] ML pipeline tamamlandı: {X_train.shape[0]} eğitim, {X_test.shape[0]} test örnek")
            
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
            
            logger.info(f"✅ [ML] Model eğitildi")
            logger.info(f"📊 [ML] Eğitim metrikleri: {training_metrics}")
            
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

            logger.info(f"💾 [ML] Ensemble modeller kaydedildi:")
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
                training_metrics  # Eğitim metrikleri
            )
            
            # 8. Tamamlandı
            self.training_state["is_training"] = False
            self.training_state["progress"] = 100
            self.training_state["message"] = f"✅ ML eğitimi tamamlandı: {request.symbol}"
            self.training_state["current_step"] = "Completed"
            
            logger.info(f"🎉 [ML] Eğitim başarıyla tamamlandı: {request.symbol}")
            
        except Exception as e:
            logger.error(f"❌ [ML] Eğitim hatası: {e}")
            logger.error(f"❌ [ML] Traceback: {traceback.format_exc()}")
            self.training_state["is_training"] = False
            self.training_state["message"] = f"Hata: {str(e)}"
            self.training_state["current_step"] = "Error"

    def _save_training_history(self, request: MLTrainRequest, model_path: str, dataset_size: int, feature_count: int, training_metrics: dict = None):
        """Eğitim geçmişini kaydet."""
        try:
            history_file = "artifacts/ml_training_history.json"
            os.makedirs("artifacts", exist_ok=True)
            
            # Training metrics'den accuracy'leri al
            accuracy = 0.0
            xgb_accuracy = 0.0
            rf_accuracy = 0.0
            ensemble_accuracy = 0.0
            f1_score = 0.0
            
            if training_metrics:
                # metrics dict'unun iç yapısını kullan
                metrics = training_metrics.get('metrics', {})
                accuracy = metrics.get('accuracy', 0.0)
                f1_score = metrics.get('f1', 0.0)
                xgb_accuracy = metrics.get('xgb_accuracy', accuracy)
                rf_accuracy = metrics.get('rf_accuracy', accuracy)
                ensemble_accuracy = metrics.get('ensemble_accuracy', accuracy)

            # Yeni kayıt
            new_entry = {
                "training_id": f"{request.symbol}_{request.timeframe}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "symbol": request.symbol,
                "timeframe": request.timeframe,
                "model_type": request.model_type,
                "dataset_size": dataset_size,
                "feature_count": feature_count,
                "tp_multiplier": getattr(request, 'tp', 2.0),
                "sl_multiplier": getattr(request, 'sl', 2.0),
                "started_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "duration_seconds": 0,  # TODO: Calculate actual duration
                "metrics": {
                    "accuracy": accuracy,
                    "f1_score": f1_score,
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

            logger.info(f"📝 [ML] Eğitim geçmişi güncellendi: {len(history)} kayıt")
            logger.info(f"📊 [ML] Metrics kaydedildi: XGB={xgb_accuracy:.4f}, RF={rf_accuracy:.4f}, Ensemble={ensemble_accuracy:.4f}")

        except Exception as e:
            logger.error(f"❌ [ML] Geçmiş kaydetme hatası: {e}")
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
            logger.error(f"Eğitim geçmişi hatası: {e}")
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

            return {"status": "success", "message": "Geçmiş silindi"}

        except Exception as e:
            logger.error(f"Geçmiş silme hatası: {e}")
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
                        logger.info(f"✅ [ML] Model dosyası silindi: {file_path}")
                    except Exception as e:
                        errors.append(f"{file_path}: {str(e)}")
                        logger.error(f"❌ [ML] Dosya silme hatası: {file_path} - {e}")

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
                        logger.info(f"✅ [ML] Training history'den {original_count - len(history)} kayıt silindi")
            except Exception as e:
                logger.warning(f"⚠️ [ML] Training history silme hatası: {e}")

            if deleted_files or history_deleted:
                return {
                    "status": "success",
                    "message": f"{len(deleted_files)} dosya ve {len([h for h in history if h.get('symbol') == symbol and h.get('timeframe') == timeframe])} history kaydı silindi" if history_deleted else f"{len(deleted_files)} dosya silindi",
                    "deleted_files": deleted_files,
                    "errors": errors if errors else None
                }
            else:
                return {
                    "status": "error",
                    "message": "Silinecek dosya bulunamadı",
                    "errors": errors
                }

        except Exception as e:
            logger.error(f"Model silme hatası: {e}")
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
            "message": "Model bulundu" if xgb_exists else "Model bulunamadı",
            "ensemble_status": {
                "xgboost": xgb_exists,
                "random_forest": rf_exists,
                "metadata": metadata_exists,
                "full_ensemble": xgb_exists and rf_exists and metadata_exists
            }
        }
