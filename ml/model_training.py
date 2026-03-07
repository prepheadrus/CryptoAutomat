"""
XGBoost Model Eğitimi ve Tahmin Modülü

Bu modül, Marcos Lopez de Prado'nun Triple Barrier Method ile etiketlenmiş
veriler üzerinde XGBoost modeli eğitir. Model hem yön tahmini yapar hem de
güven skoru (confidence score) üretir.

Mimari Kural: Model multi-class classification (multi:softprob) yapar ve
PaperTrader dinamik kaldıraç için confidence score kullanır.
"""

import os
import json
import numpy as np
import pandas as pd
from pandas import Series
from typing import Tuple, Dict, Any, Optional, List
from datetime import datetime
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)
from core.logger import logger


class ModelTrainer:
    """
    XGBoost Model Eğitici Sınıfı

    Triple Barrier etiketli veriler üzerinde çok sınıflı sınıflandırma
    (LONG/SHORT/NEUTRAL) yapar ve güven skoru üretir.
    """

    def __init__(
        self,
        n_estimators: int = 500,
        max_depth: int = 6,
        learning_rate: float = 0.1,
        subsample: float = 0.8,
        colsample_bytree: float = 0.8,
        min_child_weight: int = 3,
        gamma: float = 0.1,
        reg_alpha: float = 0.1,
        reg_lambda: float = 1.0,
        random_state: int = 42,
        n_jobs: int = -1,
        early_stopping_rounds: int = 50,
        num_class: int = 3
    ):
        """
        XGBoost modelini başlatır.

        Args:
            n_estimators: Ağaç sayısı
            max_depth: Maksimum ağaç derinliği
            learning_rate: Öğrenme oranı
            subsample: Veri örnekleme oranı
            colsample_bytree: Özellik örnekleme oranı
            min_child_weight: Minimum child weight (overfitting önleme)
            gamma: Minimum split loss (overfitting önleme)
            reg_alpha: L1 regularization
            reg_lambda: L2 regularization
            random_state: Random seed
            n_jobs: Parallel job sayısı (-1 = tüm CPU)
            early_stopping_rounds: Early stopping için round sayısı
            num_class: Sınıf sayısı (3: LONG, NEUTRAL, SHORT)
        """
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.subsample = subsample
        self.colsample_bytree = colsample_bytree
        self.min_child_weight = min_child_weight
        self.gamma = gamma
        self.reg_alpha = reg_alpha
        self.reg_lambda = reg_lambda
        self.random_state = random_state
        self.n_jobs = n_jobs
        self.early_stopping_rounds = early_stopping_rounds
        self.num_class = num_class

        # Modeli başlat
        self.model = xgb.XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            min_child_weight=min_child_weight,
            gamma=gamma,
            reg_alpha=reg_alpha,
            reg_lambda=reg_lambda,
            random_state=random_state,
            n_jobs=n_jobs,
            objective='multi:softprob',
            eval_metric='mlogloss',
            num_class=num_class,
            use_label_encoder=False
        )

        self.is_trained = False
        self.feature_names = None
        self.training_metrics = {}
        self.class_mapping = {0: 'NEUTRAL', 1: 'LONG', 2: 'SHORT'}

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: Series,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        XGBoost modelini eğitir ve değerlendirir.

        Args:
            X_train: Eğitim özellikleri
            y_train: Eğitim etiketleri
            X_test: Test özellikleri
            y_test: Test etiketleri
            verbose: Log çıktısı gösterilsin mi?

        Returns:
            Dict[str, Any]: Eğitim metrikleri
        """
        logger.info(f"Model eğitimi başlatılıyor...")
        logger.info(f"  Eğitim seti: {X_train.shape}")
        logger.info(f"  Test seti: {X_test.shape}")
        logger.info(f"  Sınıf dağılımı (train): {y_train.value_counts().to_dict()}")

        # Feature names'i sakla
        if isinstance(X_train, pd.DataFrame):
            self.feature_names = X_train.columns.tolist()
        else:
            self.feature_names = [f"feature_{i}" for i in range(X_train.shape[1])]

        # Early stopping için eval seti
        eval_set = [(X_train, y_train), (X_test, y_test)]

        # Modeli eğit (XGBoost versiyonuna göre early_stopping_rounds)
        # XGBoost 1.3+ için callbacks kullan
        try:
            import xgboost as xgb
            # Callback ile early stopping (yeni versiyonlar için)
            early_stopping_cb = xgb.callback.EarlyStopping(
                rounds=self.early_stopping_rounds,
                metric_name='mlogloss',
                data_name='eval'
            )

            self.model.fit(
                X_train,
                y_train,
                eval_set=eval_set,
                verbose=verbose,
                callbacks=[early_stopping_cb]
            )
        except (AttributeError, TypeError):
            # Eski versiyonlar için klasik parametre
            self.model.fit(
                X_train,
                y_train,
                eval_set=eval_set,
                verbose=verbose,
                early_stopping_rounds=self.early_stopping_rounds
            )

        self.is_trained = True

        # Test üzerinde değerlendirme
        y_pred = self.model.predict(X_test)

        # Metrikleri hesapla
        metrics = self._calculate_metrics(y_test, y_pred)
        self.training_metrics = metrics

        # Feature importance hesapla
        feature_importance = self._calculate_feature_importance()

        # Sonuçları logla
        logger.info("=" * 60)
        logger.info("EĞİTİM SONUÇLARI")
        logger.info("=" * 60)
        logger.info(f"Accuracy:  {metrics['accuracy']:.4f}")
        logger.info(f"Precision: {metrics['precision']:.4f}")
        logger.info(f"Recall:    {metrics['recall']:.4f}")
        logger.info(f"F1-Score:  {metrics['f1']:.4f}")
        logger.info(f"Best Iteration: {self.model.best_iteration}")
        logger.info("=" * 60)

        logger.info("\nClassification Report:")
        logger.info(metrics['classification_report'])

        logger.info("\nConfusion Matrix:")
        logger.info(f"\n{metrics['confusion_matrix']}")

        logger.info("\nTop 10 Feature Importance:")
        for feat, imp in feature_importance[:10]:
            logger.info(f"  {feat}: {imp:.4f}")

        return {
            'metrics': metrics,
            'feature_importance': feature_importance,
            'best_iteration': self.model.best_iteration
        }

    def _calculate_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> Dict[str, Any]:
        """
        Model değerlendirme metriklerini hesaplar.

        Args:
            y_true: Gerçek etiketler
            y_pred: Tahmin edilen etiketler

        Returns:
            Dict[str, Any]: Metrikler sözlüğü
        """
        # Temel metrikler (macro average)
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, average='macro', zero_division=0)
        recall = recall_score(y_true, y_pred, average='macro', zero_division=0)
        f1 = f1_score(y_true, y_pred, average='macro', zero_division=0)

        # Sınıf bazlı metrikler
        class_metrics = {}
        for cls in np.unique(y_true):
            class_metrics[f'class_{cls}'] = {
                'precision': precision_score(y_true, y_pred, labels=[cls], average='macro', zero_division=0),
                'recall': recall_score(y_true, y_pred, labels=[cls], average='macro', zero_division=0),
                'f1': f1_score(y_true, y_pred, labels=[cls], average='macro', zero_division=0)
            }

        # Raporlar
        report = classification_report(
            y_true,
            y_pred,
            target_names=[self.class_mapping.get(i, f'Class_{i}') for i in range(self.num_class)],
            zero_division=0
        )
        conf_matrix = confusion_matrix(y_true, y_pred)

        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'class_metrics': class_metrics,
            'classification_report': report,
            'confusion_matrix': conf_matrix
        }

    def _calculate_feature_importance(self) -> List[Tuple[str, float]]:
        """
        Özellik önemlerini hesaplar.

        Returns:
            List[Tuple[str, float]]: (feature_name, importance) listesi
        """
        if not self.is_trained:
            return []

        importance = self.model.feature_importances_
        if self.feature_names:
            return sorted(
                zip(self.feature_names, importance),
                key=lambda x: x[1],
                reverse=True
            )
        else:
            return [(f"feature_{i}", imp) for i, imp in enumerate(importance)]

    def predict_with_confidence(
        self,
        X: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Tahmin yapar ve güven skoru döner.

        PaperTrader için kritik: Dinamik kaldıraç confidence score'a göre
        hesaplanır.

        Args:
            X: Özellikler (tek satır veya DataFrame)

        Returns:
            Tuple: (predictions, confidence_scores, probabilities)
                - predictions: Tahmin edilen sınıflar (0, 1, 2)
                - confidence_scores: Her tahmin için güven skoru (0-1)
                - probabilities: Tüm sınıflar için olasılıklar
        """
        if not self.is_trained:
            raise RuntimeError("Model henüz eğitilmedi!")

        # Olasılıkları al (multi:softprob)
        probabilities = self.model.predict_proba(X)

        # En yüksek olasılıklı sınıfı al
        predictions = np.argmax(probabilities, axis=1)

        # Güven skoru: Tahmin edilen sınıfın olasılığı
        confidence_scores = np.max(probabilities, axis=1)

        return predictions, confidence_scores, probabilities

    def predict_single(
        self,
        X: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Tek bir örnek için detaylı tahmin döner.

        Args:
            X: Tek satırlık özellik DataFrame'i

        Returns:
            Dict[str, Any]: Tahmin detayları
        """
        predictions, confidence, probs = self.predict_with_confidence(X)

        pred_class = predictions[0]
        confidence_score = confidence[0]
        class_probs = probs[0]

        result = {
            'prediction': int(pred_class),
            'prediction_label': self.class_mapping.get(pred_class, f'Class_{pred_class}'),
            'confidence': float(confidence_score),
            'confidence_pct': float(confidence_score * 100),
            'probabilities': {
                self.class_mapping.get(i, f'Class_{i}'): float(prob)
                for i, prob in enumerate(class_probs)
            },
            'recommendation': self._get_recommendation(pred_class, confidence_score)
        }

        return result

    def _get_recommendation(
        self,
        prediction: int,
        confidence: float
    ) -> str:
        """
        Tahmin ve güvene göre işlem önerisi üretir.

        Args:
            prediction: Tahmin edilen sınıf
            confidence: Güven skoru

        Returns:
            str: İşlem önerisi
        """
        if prediction == 1:  # LONG
            if confidence >= 0.80:
                return "STRONG_LONG"
            elif confidence >= 0.65:
                return "LONG"
            else:
                return "WEAK_LONG"
        elif prediction == 2:  # SHORT
            if confidence >= 0.80:
                return "STRONG_SHORT"
            elif confidence >= 0.65:
                return "SHORT"
            else:
                return "WEAK_SHORT"
        else:  # NEUTRAL
            return "HOLD"

    def save_model(self, model_path: str = "artifacts/models/xgb_model.json") -> str:
        """
        Modeli diske kaydeder.

        Args:
            model_path: Kayıt yolu

        Returns:
            str: Kaydedilen dosya yolu
        """
        if not self.is_trained:
            raise RuntimeError("Model henüz eğitilmedi, kaydedilemez!")

        # Dizin oluştur
        os.makedirs(os.path.dirname(model_path), exist_ok=True)

        # Modeli kaydet (JSON formatı)
        self.model.save_model(model_path)

        # Metadata'yi kaydet
        metadata_path = model_path.replace('.json', '_metadata.json')
        metadata = {
            'feature_names': self.feature_names,
            'training_metrics': {
                k: float(v) if isinstance(v, (float, np.float64)) else v
                for k, v in self.training_metrics.items()
                if k not in ['classification_report', 'confusion_matrix']
            },
            'class_mapping': self.class_mapping,
            'hyperparameters': {
                'n_estimators': self.n_estimators,
                'max_depth': self.max_depth,
                'learning_rate': self.learning_rate,
                'subsample': self.subsample,
                'colsample_bytree': self.colsample_bytree,
                'min_child_weight': self.min_child_weight,
                'gamma': self.gamma,
                'reg_alpha': self.reg_alpha,
                'reg_lambda': self.reg_lambda,
                'num_class': self.num_class
            },
            'trained_at': datetime.now().isoformat()
        }

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)

        logger.info(f"Model kaydedildi: {model_path}")
        logger.info(f"Metadata kaydedildi: {metadata_path}")

        return model_path

    def load_model(self, model_path: str = "artifacts/models/xgb_model.json") -> 'ModelTrainer':
        """
        Diskten model yükler.

        Args:
            model_path: Model dosya yolu

        Returns:
            ModelTrainer: Yüklenmiş model ile self
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model dosyası bulunamadı: {model_path}")

        # Modeli yükle
        self.model.load_model(model_path)
        self.is_trained = True

        # Metadata'yi yükle
        metadata_path = model_path.replace('.json', '_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)

            self.feature_names = metadata.get('feature_names')
            self.class_mapping = {
                int(k): v for k, v in metadata.get('class_mapping', {}).items()
            }

            # Hyperparameters
            hp = metadata.get('hyperparameters', {})
            self.n_estimators = hp.get('n_estimators', self.n_estimators)
            self.max_depth = hp.get('max_depth', self.max_depth)
            self.learning_rate = hp.get('learning_rate', self.learning_rate)
            # ... diğer parametreler

            logger.info(f"Model yüklendi: {model_path}")
            logger.info(f"Özellik sayısı: {len(self.feature_names)}")
        else:
            logger.warning(f"Metadata dosyası bulunamadı: {metadata_path}")

        return self

    def get_feature_importance_df(self, top_n: int = 20) -> pd.DataFrame:
        """
        Özellik önemlerini DataFrame olarak döner.

        Args:
            top_n: İlk N özelliği göster

        Returns:
            pd.DataFrame: Özellik önemleri
        """
        importance = self._calculate_feature_importance()
        df = pd.DataFrame(importance, columns=['feature', 'importance'])
        return df.head(top_n)


def run_training_pipeline(
    df: pd.DataFrame,
    model_save_path: str = "artifacts/models/xgb_model.json",
    tp_multiplier: float = 2.0,
    sl_multiplier: float = 2.0,
    time_horizon: int = 10,
    train_ratio: float = 0.8
) -> ModelTrainer:
    """
    End-to-end eğitim pipeline'ı.

    Args:
        df: OHLCV verisi (indikatörlerle birlikte)
        model_save_path: Model kayıt yolu
        tp_multiplier: Take Profit çarpanı
        sl_multiplier: Stop Loss çarpanı
        time_horizon: Dikey bariyer mum sayısı
        train_ratio: Eğitim oranı

    Returns:
        ModelTrainer: Eğitilmiş model
    """
    from ml.data_prep import prepare_ml_data

    logger.info("=" * 60)
    logger.info("XGBOOST EĞİTİM PIPELINE'I BAŞLATILIYOR")
    logger.info("=" * 60)

    # 1. Veri hazırlama
    logger.info("\n[1/3] Veri hazırlanıyor...")
    X_train, X_test, y_train, y_test, scaler = prepare_ml_data(
        df,
        tp_multiplier=tp_multiplier,
        sl_multiplier=sl_multiplier,
        time_horizon=time_horizon,
        train_ratio=train_ratio
    )

    # 2. Model eğitimi
    logger.info("\n[2/3] Model eğitiliyor...")
    trainer = ModelTrainer(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        num_class=3
    )

    trainer.train(X_train, y_train, X_test, y_test)

    # 3. Model kaydetme
    logger.info("\n[3/3] Model kaydediliyor...")
    trainer.save_model(model_save_path)

    logger.info("\n" + "=" * 60)
    logger.info("EĞİTİM TAMAMLANDI")
    logger.info("=" * 60)

    return trainer


if __name__ == "__main__":
    """
    Test scripti: Uçtan uca eğitim pipeline'ını çalıştırır.
    """
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    from data.indicators import StrategyIndicators
    from core.database import Database
    import pandas as pd

    logger.info("XGBoost Model Eğitim Testi")
    logger.info("=" * 60)

    try:
        # 1. Veritabanından veri çek
        logger.info("\nVeritabanından veri çekiliyor...")
        db = Database()

        # Örnek: BTC/USDT verisi çek
        df = db.get_klines('BTCUSDT', timeframe='1h', limit=5000)
        db.close()

        if df is None or len(df) == 0:
            logger.error("Veri çekilemedi!")
            sys.exit(1)

        logger.info(f"Çekilen veri: {len(df)} satır")

        # 2. İndikatörleri ekle
        logger.info("\nİndikatörler hesaplanıyor...")
        df = StrategyIndicators.add_all_indicators(df)

        # 3. Eğitim pipeline'ını çalıştır
        logger.info("\nEğitim pipeline'ı başlatılıyor...")
        trainer = run_training_pipeline(
            df,
            model_save_path="artifacts/models/xgb_model_btc.json",
            tp_multiplier=2.0,
            sl_multiplier=2.0,
            time_horizon=10,
            train_ratio=0.8
        )

        # 4. Test tahmini
        logger.info("\nTest tahmini yapılıyor...")
        # Son 10 satırı test için kullan
        test_sample = df.iloc[-10:].copy()

        # Özellikleri hazırla (model'in feature_names'ine göre)
        feature_cols = trainer.feature_names
        X_test_sample = test_sample[feature_cols]

        predictions, confidence, probs = trainer.predict_with_confidence(X_test_sample)

        logger.info(f"\nSon 10 mum tahmini:")
        for i, (pred, conf) in enumerate(zip(predictions, confidence)):
            label = trainer.class_mapping.get(pred, f'Class_{pred}')
            logger.info(f"  Mum {i+1}: {label} (Güven: {conf*100:.1f}%)")

        logger.info("\n" + "=" * 60)
        logger.info("TEST BAŞARILI!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Test başarısız: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
