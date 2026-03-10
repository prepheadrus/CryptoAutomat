"""
ML Service

Business logic for ML operations.
"""

from typing import Dict, Any, List, Optional
import asyncio
import os
import json

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
            self.training_state["progress"] = 0
            self.training_state["message"] = "Veri çekiliyor..."
            
            logger.info("🧠 [ML] Eğitim başlatılıyor...")
            
            # TODO: Implement actual training logic from server.py
            # This is a placeholder - actual implementation would call ml.model_training
            
        except Exception as e:
            logger.error(f"ML eğitim hatası: {e}")
            self.training_state["is_training"] = False
            self.training_state["message"] = f"Hata: {str(e)}"
    
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
