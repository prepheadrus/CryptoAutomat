"""
Walk-Forward Optimization (WFO) Engine

Bu modül, strateji parametrelerini piyasa koşulları değiştikçe otomatik olarak optimize eder.
In-Sample (Eğitim) ve Out-of-Sample (Test) pencereleri kullanarak kayan optimizasyon yapar.

Mimari:
- Rolling Window (Kayan Pencere) yaklaşımı
- In-Sample: Son 30 gün (optimizasyon)
- Out-of-Sample: Son 7 gün (test/doğrulama)
- 16 farklı timeframe desteği
- Asenkron yapı (asyncio) - event loop'u tıkamaz
"""

import asyncio
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Callable
from datetime import datetime, timedelta
from core.logger import logger
from core.config import CONFIG

# Auto-Grid Generator (opsiyonel - otomatik ızgara için)
try:
    from core.auto_grid import generate_param_grid
    AUTO_GRID_AVAILABLE = True
except ImportError:
    AUTO_GRID_AVAILABLE = False
    logger.warning("⚠️ Auto-Grid Generator bulunamadı, manuel PARAM_GRID kullanılıyor.")

# Optuna - Bayesian Optimization (opsiyonel)
try:
    import optuna
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    logger.warning("⚠️ Optuna bulunamadı, Grid Search kullanılıyor. Kurulum: pip install optuna")


class WalkForwardOptimizer:
    """
    Walk-Forward Optimization Motoru
    
    Strateji parametrelerini zaman içinde değişen piyasa koşullarına göre
    otomatik olarak optimize eder.
    """
    
    def __init__(
        self,
        train_days: int = 30,      # In-Sample pencere (gün)
        test_days: int = 7,        # Out-of-Sample pencere (gün)
        reoptimize_interval: int = 168,  # Yeniden optimizasyon aralığı (saat)
        min_improvement: float = 0.05,   # Minimum iyileştirme (%)
        max_workers: int = 1       # Paralel işçi sayısı
    ):
        """
        WFO Motorunu başlatır.
        
        Args:
            train_days: In-Sample eğitim penceresi (gün)
            test_days: Out-of-Sample test penceresi (gün)
            reoptimize_interval: Yeniden optimizasyon sıklığı (saat)
            min_improvement: Yeni parametrelerin kabulü için minimum iyileştirme
            max_workers: Maksimum paralel işçi
        """
        self.train_days = train_days
        self.test_days = test_days
        self.reoptimize_interval = reoptimize_interval
        self.min_improvement = min_improvement
        self.max_workers = max_workers
        
        # Optimizasyon geçmişi
        self.optimization_history = []
        self.last_optimization = None
        self.is_optimizing = False
        
        # Strateji parametre cache'i
        self.current_params = {}
        self.best_params = {}
        
        logger.info(f"🧠 WFO Motoru başlatıldı: Train={train_days}g, Test={test_days}g")
    
    async def run_wfo(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        param_grid: Dict[str, List[Any]],
        timeframe: str = "1h",
        symbol: str = "BTCUSDT",
        optimization_metric: str = "net_pnl"  # net_pnl, sharpe, sortino
    ) -> Dict[str, Any]:
        """
        Walk-Forward Optimization döngüsünü çalıştırır.
        
        Algoritma:
        1. Veriyi In-Sample ve Out-of-Sample olarak böl
        2. In-Sample üzerinde grid search ile en iyi parametreleri bul
        3. Out-of-Sample üzerinde test et
        4. İyileştirme varsa parametreleri güncelle
        
        Args:
            df: OHLCV verisi (seçili timeframe'de)
            strategy_class: Optimize edilecek strateji sınıfı
            param_grid: Parametre aralıkları
            timeframe: Zaman dilimi
            symbol: Sembol adı
            optimization_metric: Optimizasyon metriği
            
        Returns:
            Dict: Optimizasyon sonuçları
        """
        if self.is_optimizing:
            logger.warning("⚠️ WFO zaten çalışıyor, yeni istek reddedildi.")
            return {"status": "already_running"}
        
        self.is_optimizing = True
        
        try:
            logger.info(f"🔍 [WFO] {symbol} ({timeframe}) optimizasyonu başlatılıyor...")
            start_time = datetime.now()
            
            # 1. Veriyi hazırla
            df = df.dropna().copy()
            
            if len(df) < (self.train_days + self.test_days):
                logger.warning(f"⚠️ [WFO] Yetersiz veri: {len(df)} mum. Minimum {(self.train_days + self.test_days)} mum gerekli.")
                return {"status": "insufficient_data"}
            
            # 2. In-Sample ve Out-of-Sample pencerelerini belirle
            # In-Sample: Son train_days gün
            # Out-of-Sample: Son test_days gün (In-Sample'den sonra gelen)
            
            # Mum sayısını hesapla (timeframe'e göre)
            candles_per_day = self._get_candles_per_day(timeframe)
            train_size = int(self.train_days * candles_per_day)
            test_size = int(self.test_days * candles_per_day)
            
            # Veriyi böl
            df_train = df.iloc[-(train_size + test_size):-test_size].copy()
            df_test = df.iloc[-test_size:].copy()
            
            logger.info(f"📊 [WFO] Veri bölündü: Train={len(df_train)} mum, Test={len(df_test)} mum")

            # 3. In-Sample üzerinde Bayesian Optimization
            logger.info("🔬 [WFO] In-Sample optimizasyon (Bayesian Search)...")

            # Grid Search kombinasyon sayısını hesapla (karşılaştırma için)
            import itertools
            param_names = list(param_grid.keys())
            param_values = list(param_grid.values())
            total_combinations = sum(1 for _ in itertools.product(*param_values))

            logger.info(f"📊 [BAYES-OPT] Geleneksel Grid Search ile {total_combinations} ihtimal vardı")

            best_params, best_score = await self._bayesian_search(
                df_train, strategy_class, param_grid, optimization_metric, n_trials=50
            )

            if best_params is None:
                logger.error("❌ [WFO] Optimum parametre bulunamadı!")
                return {"status": "no_optimal_params"}

            logger.info(f"✅ [WFO] En iyi parametreler bulundu: {best_params}")
            logger.info(f"📈 [WFO] In-Sample {optimization_metric}: {best_score:.4f}")

            # 4. Out-of-Sample üzerinde test et
            logger.info("🧪 [WFO] Out-of-Sample test...")
            oos_score = await self._test_params(
                df_test, strategy_class, best_params, optimization_metric
            )

            logger.info(f"📊 [WFO] Out-of-Sample {optimization_metric}: {oos_score:.4f}")

            # 5. Mevcut parametrelerle karşılaştır
            improvement = self._calculate_improvement(best_score, oos_score)

            # 6. İyileştirme yeterli mi?
            if improvement >= self.min_improvement:
                logger.info(f"✅ [WFO] İyileştirme tespit edildi: +{improvement*100:.1f}%")

                # ZERO-TOUCH log mesajı
                logger.info(
                    f"🎯 [ZERO-TOUCH WFO] {strategy_class.__name__} otonom olarak analiz edildi. "
                    f"Auto-Grid sınırları çizdi, Bayes motoru {n_trials} iterasyonda en iyi ayarı buldu. "
                    f"Yeni Parametreler: {best_params}"
                )

                # Parametreleri güncelle
                old_params = self.current_params.copy()
                self.current_params = best_params
                self.best_params = best_params
                
                # Optimizasyon geçmişini kaydet
                self.optimization_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "old_params": old_params,
                    "new_params": best_params,
                    "in_sample_score": best_score,
                    "out_of_sample_score": oos_score,
                    "improvement": improvement
                })
                
                self.last_optimization = datetime.now()
                
                # Log çıktısı
                self._log_optimization_result(
                    strategy_class.__name__, timeframe, old_params, best_params, oos_score
                )
                
                return {
                    "status": "optimized",
                    "old_params": old_params,
                    "new_params": best_params,
                    "in_sample_score": best_score,
                    "out_of_sample_score": oos_score,
                    "improvement": improvement
                }
            else:
                logger.info(f"⚠️ [WFO] İyileştirme yetersiz: +{improvement*100:.1f}% (Minimum: +{self.min_improvement*100:.1f}%)")
                
                return {
                    "status": "no_improvement",
                    "current_params": self.current_params,
                    "improvement": improvement
                }
                
        except Exception as e:
            logger.error(f"❌ [WFO] Optimizasyon hatası: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {"status": "error", "error": str(e)}
            
        finally:
            self.is_optimizing = False
    
    async def _bayesian_search(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        param_grid: Dict[str, List[Any]],
        metric: str,
        n_trials: int = 50
    ) -> Tuple[Optional[Dict], float]:
        """
        Bayesian Optimization (Optuna) ile en iyi parametreleri bulur.

        Grid Search yerine sadece 50 deneme ile optimum noktayı bulur.
        TPE (Tree-structured Parzen Estimator) algoritması kullanır.

        Args:
            df: Eğitim verisi
            strategy_class: Strateji sınıfı
            param_grid: Parametre aralıkları
            metric: Optimizasyon metriği
            n_trials: Maksimum deneme sayısı

        Returns:
            Tuple: (En iyi parametreler, En iyi skor)
        """
        if not OPTUNA_AVAILABLE:
            logger.warning("⚠️ [WFO] Optuna yok, Grid Search'e dönülüyor...")
            return await self._grid_search(df, strategy_class, param_grid, metric)

        logger.info(f"🧠 [BAYES-OPT] Bayesian Optimization başlatılıyor ({n_trials} trial)...")

        # Auto-Grid'den gelen param_grid'i search space'e dönüştür
        search_space = self._convert_to_search_space(param_grid)

        logger.debug(f"📊 [BAYES-OPT] Arama uzayı: {len(search_space)} parametre")

        # Optuna study oluştur (TPE sampler)
        sampler = optuna.samplers.TPESampler(seed=42)
        study = optuna.create_study(
            direction="maximize",
            sampler=sampler,
            study_name=f"wfo_{strategy_class.__name__}"
        )

        # Objective fonksiyon
        async def objective(trial):
            # Search space'den parametre öner
            params = {}
            for param_name, param_range in search_space.items():
                if param_range['type'] == 'categorical':
                    params[param_name] = trial.suggest_categorical(param_name, param_range['values'])
                elif param_range['type'] == 'float':
                    params[param_name] = trial.suggest_float(param_name, param_range['low'], param_range['high'])
                else:  # int
                    params[param_name] = trial.suggest_int(param_name, param_range['low'], param_range['high'])

            # Backtest yap
            try:
                score = await self._backtest_params(df, strategy_class, params, metric)
                return score
            except Exception as e:
                logger.debug(f"⚠️ [BAYES-OPT] Trial hatası: {str(e)}")
                return float('-inf')

        # Optimizasyonu çalıştır
        logger.info(f"🔍 [BAYES-OPT] Optimum parametreler aranıyor...")

        # Optuna'yı async context'te çalıştır
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, study.optimize, objective, n_trials, show_progress_bar=False)

        # En iyi sonuçları al
        best_params = study.best_params
        best_score = study.best_value

        logger.info(f"✅ [BAYES-OPT] Optimizasyon tamamlandı!")
        logger.info(f"📈 [BAYES-OPT] En iyi {metric}: {best_score:.4f}")
        logger.info(f"🎯 [BAYES-OPT] En iyi parametreler: {best_params}")

        return best_params, best_score

    def _convert_to_search_space(
        self,
        param_grid: Dict[str, List[Any]]
    ) -> Dict[str, Dict]:
        """
        Auto-Grid param_grid'i Optuna search space'e dönüştürür.

        Args:
            param_grid: {'rsi_period': [10, 14, 20], 'atr_multiplier': [2.45, 3.5, 4.55]}

        Returns:
            Dict: {'rsi_period': {'type': 'int', 'low': 10, 'high': 20}, ...}
        """
        search_space = {}

        for param_name, values in param_grid.items():
            if not values or len(values) == 0:
                continue

            # Değerlerin tipini kontrol et
            if all(isinstance(v, int) for v in values):
                # Integer parametre
                search_space[param_name] = {
                    'type': 'int',
                    'low': min(values),
                    'high': max(values)
                }
            elif all(isinstance(v, float) for v in values):
                # Float parametre
                search_space[param_name] = {
                    'type': 'float',
                    'low': min(values),
                    'high': max(values)
                }
            else:
                # Categorical parametre
                search_space[param_name] = {
                    'type': 'categorical',
                    'values': values
                }

        return search_space

    async def _grid_search(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        param_grid: Dict[str, List[Any]],
        metric: str
    ) -> Tuple[Optional[Dict], float]:
        """
        Grid Search ile en iyi parametreleri bulur.
        (Artık sadece fallback olarak kullanılıyor - Optuna yoksa)

        Args:
            df: Eğitim verisi
            strategy_class: Strateji sınıfı
            param_grid: Parametre aralıkları
            metric: Optimizasyon metriği

        Returns:
            Tuple: (En iyi parametreler, En iyi skor)
        """
        import itertools

        # Parametre kombinasyonlarını oluştur
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())

        best_params = None
        best_score = float('-inf')
        total_combinations = sum(1 for _ in itertools.product(*param_values))

        logger.warning(f"⚠️ [WFO] Grid Search kullanılıyor ({total_combinations} kombinasyon) - Optuna kurun!")

        combination_count = 0

        for combination in itertools.product(*param_values):
            combination_count += 1
            current_params = dict(zip(param_names, combination))

            try:
                # Parametrelerle backtest yap
                score = await self._backtest_params(
                    df, strategy_class, current_params, metric
                )

                # En iyi skoru güncelle
                if score > best_score:
                    best_score = score
                    best_params = current_params.copy()

                if combination_count % 10 == 0:
                    logger.debug(f"📊 [WFO] İlerleme: {combination_count}/{total_combinations} - En iyi: {best_score:.4f}")

            except Exception as e:
                logger.debug(f"⚠️ [WFO] Kombinasyon hatası: {current_params} - {str(e)}")
                continue

        logger.info(f"✅ [WFO] Grid Search tamamlandı: {combination_count} kombinasyon")

        return best_params, best_score
    
    async def _backtest_params(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        params: Dict[str, Any],
        metric: str
    ) -> float:
        """
        Belirli parametrelerle backtest yapar.
        
        Args:
            df: Veri
            strategy_class: Strateji sınıfı
            params: Parametreler
            metric: Metrik
            
        Returns:
            float: Skor (PnL veya Sharpe)
        """
        try:
            # Strateji örneği oluştur
            strategy = strategy_class()
            
            # Parametreleri uygula
            for param_name, param_value in params.items():
                if hasattr(strategy, param_name):
                    setattr(strategy, param_name, param_value)
            
            # Basit backtest simülasyonu
            # Gerçek implementasyonda VectorizedBacktester kullanılabilir
            
            trades = []
            position = 0
            entry_price = 0
            total_pnl = 0
            
            # Sinyalleri üret
            for i in range(1, len(df)):
                row = df.iloc[i]
                prev_row = df.iloc[i-1]
                
                try:
                    signal = strategy.generate_signal(row)
                except:
                    signal = 1  # HOLD
                
                # Pozisyon aç/kapat
                if signal == 2 and position == 0:  # AL
                    position = 1
                    entry_price = row['close']
                elif signal == 0 and position == 1:  # SAT (LONG kapat)
                    pnl = (row['close'] - entry_price) / entry_price
                    total_pnl += pnl
                    trades.append(pnl)
                    position = 0
                elif signal == 3 and position == 0:  # SHORT
                    position = -1
                    entry_price = row['close']
                elif signal == 1 and position != 0:  # HOLD (pozisyon kapat)
                    if position == 1:
                        pnl = (row['close'] - entry_price) / entry_price
                    else:
                        pnl = (entry_price - row['close']) / entry_price
                    total_pnl += pnl
                    trades.append(pnl)
                    position = 0
            
            # Metriği hesapla
            if metric == "net_pnl":
                return total_pnl
            elif metric == "sharpe":
                if len(trades) < 2:
                    return 0
                returns = pd.Series(trades)
                return (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() > 0 else 0
            elif metric == "sortino":
                if len(trades) < 2:
                    return 0
                returns = pd.Series(trades)
                downside = returns[returns < 0]
                if len(downside) == 0:
                    return returns.mean() * np.sqrt(252)
                return (returns.mean() / downside.std()) * np.sqrt(252)
            else:
                return total_pnl
                
        except Exception as e:
            logger.debug(f"⚠️ [WFO] Backtest hatası: {str(e)}")
            return float('-inf')
    
    async def _test_params(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        params: Dict[str, Any],
        metric: str
    ) -> float:
        """
        Parametreleri Out-of-Sample verisinde test eder.
        
        Args:
            df: Test verisi
            strategy_class: Strateji sınıfı
            params: Parametreler
            metric: Metrik
            
        Returns:
            float: Test skoru
        """
        return await self._backtest_params(df, strategy_class, params, metric)
    
    def _calculate_improvement(self, new_score: float, old_score: float) -> float:
        """
        İyileştirme oranını hesaplar.
        
        Args:
            new_score: Yeni skor
            old_score: Eski skor
            
        Returns:
            float: İyileştirme oranı (0-1 arası)
        """
        if old_score == 0:
            return 0 if new_score == 0 else 1.0
        
        return (new_score - old_score) / abs(old_score)
    
    def _log_optimization_result(
        self,
        strategy_name: str,
        timeframe: str,
        old_params: Dict,
        new_params: Dict,
        oos_score: float
    ):
        """
        Optimizasyon sonucunu loglar.
        
        Args:
            strategy_name: Strateji adı
            timeframe: Zaman dilimi
            old_params: Eski parametreler
            new_params: Yeni parametreler
            oos_score: Out-of-Sample skor
        """
        # Değişen parametreleri bul
        changes = []
        for key in new_params:
            if key in old_params and old_params[key] != new_params[key]:
                changes.append(f"{key}: {old_params[key]} -> {new_params[key]}")
        
        if changes:
            changes_str = ", ".join(changes)
            logger.info(
                f"🎯 [WFO] {strategy_name} ({timeframe}) optimize edildi. "
                f"{changes_str} (OOS PnL: {oos_score*100:+.2f}%)"
            )
        else:
            logger.info(
                f"🎯 [WFO] {strategy_name} ({timeframe}) optimize edildi. "
                f"Yeni parametreler uygulandı (OOS PnL: {oos_score*100:+.2f}%)"
            )
    
    def _get_candles_per_day(self, timeframe: str) -> float:
        """
        Timeframe'e göre günlük mum sayısını hesaplar.
        
        Args:
            timeframe: Zaman dilimi (örn: 1m, 5m, 1h, 1d)
            
        Returns:
            float: Günlük mum sayısı
        """
        if timeframe.endswith('m'):
            minutes = int(timeframe.replace('m', ''))
            return (24 * 60) / minutes
        elif timeframe.endswith('h'):
            hours = int(timeframe.replace('h', ''))
            return 24 / hours
        elif timeframe.endswith('d'):
            days = int(timeframe.replace('d', ''))
            return 1 / days
        else:
            return 1  # Varsayılan
    
    def should_reoptimize(self) -> bool:
        """
        Yeniden optimizasyon zamanı geldi mi kontrol eder.
        
        Returns:
            bool: Optimizasyon gerekli mi?
        """
        if self.last_optimization is None:
            return True
        
        hours_since_last = (datetime.now() - self.last_optimization).total_seconds() / 3600
        return hours_since_last >= self.reoptimize_interval
    
    def get_optimization_history(self, limit: int = 10) -> List[Dict]:
        """
        Optimizasyon geçmişini döner.
        
        Args:
            limit: Maksimum kayıt sayısı
            
        Returns:
            List[Dict]: Optimizasyon geçmişi
        """
        return self.optimization_history[-limit:]
    
    def get_current_params(self) -> Dict:
        """
        Mevcut parametreleri döner.
        
        Returns:
            Dict: Mevcut parametreler
        """
        return self.current_params.copy()


# Global WFO instance'ları (sembol bazlı)
_wfo_instances = {}


def get_wfo_engine(symbol: str) -> WalkForwardOptimizer:
    """
    Sembol için WFO motorunu alır (yoksa oluşturur).
    
    Args:
        symbol: Sembol adı
        
    Returns:
        WalkForwardOptimizer: WFO motoru
    """
    if symbol not in _wfo_instances:
        _wfo_instances[symbol] = WalkForwardOptimizer()
    
    return _wfo_instances[symbol]


async def start_wfo_background_task(
    symbol: str,
    timeframe: str,
    strategy_class: Any,
    param_grid: Dict[str, List[Any]] = None,
    data_fetcher: Callable = None,
    optimization_metric: str = "sharpe",
    n_trials: int = 50
):
    """
    Arka planda sürekli WFO optimizasyonu yapan asenkron görev.
    TAM OTONOM - param_grid=None ise Auto-Grid + Bayesian Optimization kullanır.

    Args:
        symbol: Sembol adı
        timeframe: Zaman dilimi
        strategy_class: Strateji sınıfı
        param_grid: Parametre aralıkları (None ise otomatik oluşturulur - ZERO-TOUCH)
        data_fetcher: Veri çekme fonksiyonu (async) - None ise varsayılan DB fetcher kullanılır
        optimization_metric: Optimizasyon metriği
        n_trials: Maksimum deneme sayısı (Bayesian için)
    """
    # Varsayılan veri çekici: DB'den Klines verisi
    if data_fetcher is None:
        async def default_data_fetcher(sym: str, tf: str):
            from data.database import db_manager
            try:
                await db_manager.connect()
                klines = await db_manager.get_klines(sym, timeframe=tf, limit=1000)
                if klines:
                    import pandas as pd
                    df = pd.DataFrame(klines, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                    df['timestamp'] = pd.to_numeric(df['timestamp'], errors='coerce')
                    df = df.sort_values('timestamp').reset_index(drop=True)
                    return df
                return None
            except Exception as e:
                logger.error(f"❌ [WFO] Veri çekme hatası: {e}")
                return None

        data_fetcher = default_data_fetcher

    wfo = get_wfo_engine(symbol)

    # FAZ 3: TAM OTONOM AKIŞ
    # param_grid=None ise Auto-Grid otomatik oluşturur
    if param_grid is None:
        if AUTO_GRID_AVAILABLE:
            logger.info(f"🤖 [ZERO-TOUCH] {symbol} için otomatik parametre ızgarası oluşturuluyor...")
            param_grid = generate_param_grid(strategy_class=strategy_class)

            if not param_grid:
                logger.error(f"❌ [ZERO-TOUCH] {symbol} için otomatik ızgara oluşturulamadı!")
                return

            logger.info(f"✅ [ZERO-TOUCH] Auto-Grid {len(param_grid)} parametre oluşturdu")
        else:
            logger.error(f"❌ [ZERO-TOUCH] {symbol} için param_grid tanımlı değil ve Auto-Grid mevcut değil!")
            return

    logger.info(f"🔄 [WFO] Arka plan görevi başlatıldı: {symbol} ({timeframe})")

    # ============================================
    # WFO DURUM KONTROLÜ (LOGGING)
    # Kullanıcı arka planda WFO'nun çalıştığını bilmeli
    # ============================================
    logger.info(f"⏳ [WFO-STATUS] Arka plan otonom optimizasyon motoru şu an devrede ve {symbol} ({timeframe}) için veri işliyor...")

    while True:
        try:
            # Yeniden optimizasyon zamanı geldi mi?
            if wfo.should_reoptimize() and not wfo.is_optimizing:
                logger.info(f"🔍 [WFO] {symbol} için optimizasyon tetiklendi...")

                # Veri çek
                df = await data_fetcher(symbol, timeframe)

                if df is not None and len(df) > 0:
                    # WFO çalıştır
                    result = await wfo.run_wfo(
                        df=df,
                        strategy_class=strategy_class,
                        param_grid=param_grid,
                        timeframe=timeframe,
                        symbol=symbol,
                        optimization_metric=optimization_metric
                    )

                    if result.get('status') == 'optimized':
                        logger.info(f"✅ [WFO] {symbol} parametreleri güncellendi!")

                        # FAZ 4: Canlı parametre güncellemesi
                        # PaperTrader'daki aktif stratejiyi bul ve güncelle
                        try:
                            from core.paper import paper_engine

                            if symbol in paper_engine.strategies and paper_engine.strategies[symbol] is not None:
                                # Strateji parametrelerini canlı olarak güncelle
                                success = paper_engine.update_strategy_params(
                                    symbol=symbol,
                                    new_params=result['new_params'],
                                    sharpe=result.get('out_of_sample_score', 0)
                                )

                                if success:
                                    logger.info(f"🎯 [WFO] {symbol} canlı parametre güncellemesi başarılı!")
                                else:
                                    logger.warning(f"⚠️ [WFO] {symbol} parametre güncellemesi başarısız.")
                            else:
                                logger.warning(f"⚠️ [WFO] {symbol} için aktif strateji bulunamadı.")
                        except Exception as e:
                            logger.error(f"❌ [WFO] Canlı güncelleme hatası: {str(e)}")

                    elif result.get('status') == 'no_improvement':
                        logger.info(f"⚠️ [WFO] {symbol} için iyileştirme bulunamadı.")
                else:
                    logger.warning(f"⚠️ [WFO] {symbol} için veri çekilemedi.")

            # 1 saat bekle
            await asyncio.sleep(3600)

            # Döngü devam ediyor - durum kontrolü
            logger.debug(f"⏳ [WFO-STATUS] {symbol} için otonom optimizasyon izleniyor... (sonraki kontrol 1 saat)")

        except asyncio.CancelledError:
            logger.info(f"🛑 [WFO] {symbol} arka plan görevi durduruldu.")
            break
        except Exception as e:
            logger.error(f"❌ [WFO] Arka plan hatası ({symbol}): {str(e)}")
            await asyncio.sleep(3600)
