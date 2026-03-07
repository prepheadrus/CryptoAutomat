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
            
            # 3. In-Sample üzerinde Grid Search
            logger.info("🔬 [WFO] In-Sample optimizasyon (Grid Search)...")
            best_params, best_score = await self._grid_search(
                df_train, strategy_class, param_grid, optimization_metric
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
    
    async def _grid_search(
        self,
        df: pd.DataFrame,
        strategy_class: Any,
        param_grid: Dict[str, List[Any]],
        metric: str
    ) -> Tuple[Optional[Dict], float]:
        """
        Grid Search ile en iyi parametreleri bulur.
        
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
        
        logger.debug(f"🔢 [WFO] Toplam {total_combinations} kombinasyon denenecek...")
        
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
    param_grid: Dict[str, List[Any]],
    data_fetcher: Callable,
    optimization_metric: str = "sharpe"
):
    """
    Arka planda sürekli WFO optimizasyonu yapan asenkron görev.
    
    Args:
        symbol: Sembol adı
        timeframe: Zaman dilimi
        strategy_class: Strateji sınıfı
        param_grid: Parametre aralıkları
        data_fetcher: Veri çekme fonksiyonu (async)
        optimization_metric: Optimizasyon metriği
    """
    wfo = get_wfo_engine(symbol)
    
    logger.info(f"🔄 [WFO] Arka plan görevi başlatıldı: {symbol} ({timeframe})")
    
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
                    elif result.get('status') == 'no_improvement':
                        logger.info(f"⚠️ [WFO] {symbol} için iyileştirme bulunamadı.")
                else:
                    logger.warning(f"⚠️ [WFO] {symbol} için veri çekilemedi.")
            
            # 1 saat bekle
            await asyncio.sleep(3600)
            
        except asyncio.CancelledError:
            logger.info(f"🛑 [WFO] {symbol} arka plan görevi durduruldu.")
            break
        except Exception as e:
            logger.error(f"❌ [WFO] Arka plan hatası ({symbol}): {str(e)}")
            await asyncio.sleep(3600)
