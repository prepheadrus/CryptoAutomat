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

        model_path = f"artifacts/models/xgb_model_{request.symbol.lower().replace('/', '').replace(':', '')}_{request.timeframe}.json"

        return {
            "status": "success",
            "message": f"ML modeli eğitimi başlatıldı ({request.symbol})...",
            "model_path": model_path
        }

    async def _run_training(self, request: MLTrainRequest):
        """Arka planda ML modelini eğitir."""
        try:
            self.training_state["is_training"] = True
            self.training_state["progress"] = 5
            self.training_state["message"] = "Veri çekiliyor..."
            self.training_state["current_step"] = "DB bağlantısı"

            logger.info(f"🧠 [ML] Eğitim başlatılıyor: {request.symbol} ({request.timeframe}) - {request.limit} mum")

            # 1. Veritabanından veri çek
            from data.database import db_manager
            await db_manager.connect()
            
            self.training_state["progress"] = 15
            self.training_state["message"] = "Veri işleniyor..."
            self.training_state["current_step"] = "Feature engineering"
            
            logger.info(f"📊 [ML] Veri çekiliyor: {request.symbol}, {request.timeframe}, limit={request.limit}")
            
            # Klines verisini çek (list of tuples döner)
            klines_data = await db_manager.get_klines(request.symbol, request.timeframe, limit=request.limit)
            
            if not klines_data or len(klines_data) == 0:
                raise ValueError(f"Veritabanında yeterli veri yok: {request.symbol} {request.timeframe}")
            
            # List of tuples'u DataFrame'e çevir
            import pandas as pd
            df = pd.DataFrame(klines_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            
            # Timestamp'i numeric'e çevir (string olabilir)
            df['timestamp'] = pd.to_numeric(df['timestamp'], errors='coerce')
            
            # Timestamp'i ms'den saniyeye çevir (gerekirse)
            if pd.notna(df['timestamp'].iloc[0]) and df['timestamp'].iloc[0] > 1e12:
                df['timestamp'] = df['timestamp'] // 1000
            
            # DataFrame'i hazırla (ML eğitimi için gerekli format)
            df = df.sort_values('timestamp').reset_index(drop=True)
            
            logger.info(f"✅ [ML] {len(df)} mum çekildi ve DataFrame'e çevrildi")
            
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
            
            symbol_clean = request.symbol.replace('/', '').replace(':', '').replace('-', '').lower()
            model_dir = "artifacts/models"
            os.makedirs(model_dir, exist_ok=True)
            model_path = f"{model_dir}/xgb_model_{symbol_clean}_{request.timeframe}.json"
            
            # XGBoost modelini kaydet
            trainer.xgb_model.save_model(model_path)
            
            logger.info(f"💾 [ML] Model kaydedildi: {model_path}")
            
            # 7. Eğitim geçmişini güncelle
            self.training_state["progress"] = 95
            self.training_state["message"] = "Geçmiş güncelleniyor..."
            self.training_state["current_step"] = "Update history"
            
            self._save_training_history(
                request, 
                model_path, 
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

    def check_model(self, symbol: str, timeframe: str) -> Dict[str, Any]:
        """
        Model varlığını kontrol et.

        Args:
            symbol: Sembol
            timeframe: Zaman dilimi

        Returns:
            Model kontrol yanıtı
        """
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').lower()
        model_path = f"artifacts/models/xgb_model_{symbol_clean}_{timeframe}.json"

        model_exists = os.path.exists(model_path)

        return {
            "status": "success",
            "model_exists": model_exists,
            "model_path": model_path if model_exists else None,
            "message": "Model bulundu" if model_exists else "Model bulunamadı"
        }
