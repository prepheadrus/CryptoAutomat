"""
Walk-Forward Optimization (WFO) Motoru

Bu modül, strateji parametrelerinin zaman içinde değişen piyasa koşullarına göre
optimize edilmesini sağlar. Belirlenen parametre kombinasyonları üzerinde
grid search yaparak en iyi performans gösteren kombinasyonu bulur.
"""

import itertools
import pandas as pd
from typing import Dict, Any, List, Tuple
from core.logger import logger


class WalkForwardOptimizer:
    """
    Walk-Forward Optimization (WFO) sınıfı.
    
    Parametre aralıklarını alır ve grid search yöntemiyle en iyi parametre
    kombinasyonunu bulur. Her bir kombinasyon için VectorizedBacktester
    kullanarak backtest yapar ve en yüksek net PnL getiren kombinasyonu döner.
    """
    
    def __init__(self):
        self.results = []
    
    def run_grid_search(self, df: pd.DataFrame, strategy_class, param_grid: Dict[str, List[Any]]) -> Dict[str, Any]:
        """
        Parametre ızgarası üzerinde grid search yapar ve en iyi parametreleri döner.
        
        Args:
            df: Backtest yapılacak veri seti
            strategy_class: Strateji sınıfı (BaseStrategy'den türemiş olmalı)
            param_grid: Parametre adı ve değerlerinden oluşan sözlük
                      Örnek: {'ema_fast': [5, 10, 15], 'rsi_period': [14, 20]}
        
        Returns:
            Dict[str, Any]: En iyi parametreler ve skor
        """
        # Parametre kombinasyonlarını oluştur
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        
        best_params = {}
        best_score = float('-inf')
        total_combinations = 0
        
        # Tüm kombinasyonları gez
        for combination in itertools.product(*param_values):
            current_params = dict(zip(param_names, combination))
            total_combinations += 1
            
            try:
                # Parametreleri stratejiye uygulayarak backtest yap
                score = self._evaluate_strategy(df, strategy_class, current_params)
                
                # Sonuçları sakla
                self.results.append({
                    'params': current_params,
                    'score': score
                })
                
                # En iyi skoru güncelle
                if score > best_score:
                    best_score = score
                    best_params = current_params.copy()
                    
            except Exception as e:
                logger.error(f"Parametre kombinasyonu başarısız oldu {current_params}: {str(e)}")
                # Hata durumunda bu kombinasyonu atla
                continue
        
        logger.info(f"Toplam {total_combinations} kombinasyondan {len(self.results)} başarıyla tamamlandı.")
        logger.info(f"En iyi skor: {best_score} | En iyi parametreler: {best_params}")
        
        return {
            'best_params': best_params,
            'best_score': best_score,
            'total_evaluated': len(self.results)
        }
    
    def _evaluate_strategy(self, df: pd.DataFrame, strategy_class, params: Dict[str, Any]) -> float:
        """
        Belirli parametrelerle stratejiyi değerlendirir ve net PnL döner.
        
        Args:
            df: Veri seti
            strategy_class: Strateji sınıfı
            params: Parametreler sözlüğü
        
        Returns:
            float: Net PnL (kar-zarar)
        """
        # Strateji örneği oluştur
        strategy = strategy_class()
        
        # Parametreleri stratejiye uygula
        # Burada strateji sınıfına özel parametre atama mekanizması olabilir
        # Bu örnek için sadece strateji sınıfında gerekli setter metodları olacağını varsayıyoruz
        
        # Basit bir geriye dönük test simülasyonu
        # Gerçek implementasyonda VectorizedBacktester kullanılmalı
        
        # Parametreleri doğrudan strateji nesnesine atayalım
        for param_name, param_value in params.items():
            if hasattr(strategy, param_name):
                setattr(strategy, param_name, param_value)
            else:
                # Eğer doğrudan özellik olarak yoksa, stratejiye özel parametre atama fonksiyonu olabilir
                setter_method = f"set_{param_name}"
                if hasattr(strategy, setter_method):
                    getattr(strategy, setter_method)(param_value)
        
        # Simüle edilmiş backtest
        # Bu kısım VectorizedBacktester sınıfı ile değiştirilmeli
        net_pnl = self._simulate_backtest(df, strategy)
        
        return net_pnl
    
    def _simulate_backtest(self, df: pd.DataFrame, strategy) -> float:
        """
        Basit bir backtest simülasyonu.
        Gerçek implementasyonda VectorizedBacktester kullanılmalı.
        
        Args:
            df: Veri seti
            strategy: Strateji örneği
        
        Returns:
            float: Net PnL
        """
        # Strateji sinyalleri oluştur
        signals = []
        for idx, row in df.iterrows():
            signal = strategy.generate_signal(row)
            signals.append(signal)
        
        # İşlem geçmişini simüle et
        positions = []
        current_position = 0
        entry_price = 0
        total_pnl = 0
        
        for i in range(1, len(signals)):
            prev_signal = signals[i-1]
            curr_signal = signals[i]
            current_price = df['close'].iloc[i]
            prev_price = df['close'].iloc[i-1]
            
            # Pozisyon açma/kapama mantığı
            if prev_signal == 1:  # BEKLE
                continue
            elif prev_signal == 2 and current_position <= 0:  # AL
                entry_price = current_price
                current_position = 1
            elif prev_signal == 0 and current_position >= 0:  # SAT
                if current_position != 0:  # Pozisyon varsa
                    if current_position == 1:  # LONG pozisyonu kapat
                        pnl = (current_price - entry_price) / entry_price
                    else:  # SHORT pozisyonu kapat
                        pnl = (entry_price - current_price) / entry_price
                    total_pnl += pnl
                    current_position = 0
            # Pozisyon açık kalırsa, kar/zarar hesapla
            elif current_position != 0 and curr_signal != prev_signal:
                if current_position == 1:  # LONG pozisyonu kapat
                    pnl = (current_price - entry_price) / entry_price
                else:  # SHORT pozisyonu kapat
                    pnl = (entry_price - current_price) / entry_price
                total_pnl += pnl
                current_position = 0
        
        return total_pnl