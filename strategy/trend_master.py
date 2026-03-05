from strategy.base import BaseStrategy
import pandas as pd

class TrendMasterPro(BaseStrategy):
    """
    Şu anki varsayılan stratejimiz. 1 Dakikalık grafiklerde 
    200 EMA ana trendine sadık kalarak RSI 50 ve SMA 20 
    ile giriş arar. Geniş stop (3.5x ATR) kullanır.
    """
    
    def name(self) -> str:
        return "TrendMaster Pro"

    def description(self) -> str:
        return "SMA 20, EMA 200 ve RSI 50 ile 1 dakikalık trend takibi yapar. Güvenli ve stabil bir bot setidir."

    def generate_signal(self, current_row: pd.Series) -> int:
        close_p = current_row['close']
        
        # --- LONG ---
        # Fiyat EMA 200 ve SMA 20 üzerinde, RSI 50+
        trend_up = (close_p > current_row.get('EMA_200', 0)) and (close_p > current_row['SMA_20'])
        mom_up = 50 < current_row['RSI_14'] < 70
        
        if trend_up and mom_up:
            return 2
            
        # --- SHORT ---
        # Fiyat EMA 200 ve SMA 20 altında, RSI 50-
        trend_down = (close_p < current_row.get('EMA_200', 999999)) and (close_p < current_row['SMA_20'])
        mom_down = 30 < current_row['RSI_14'] < 50
        
        if trend_down and mom_down:
            return 0
            
        return 1

    def get_stop_params(self):
        # ATR çarpanı ve Kâr-al çarpanı
        return {"atr_multiplier": 3.5, "tp_multiplier": 2.0}
