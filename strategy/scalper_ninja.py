from strategy.base import BaseStrategy
import pandas as pd

class ScalperNinja(BaseStrategy):
    """
    Kısa vadeli fiyat sıçramalarına odaklanan hızlı bot.
    5 ve 13 EMA kesişimlerini yakalar ve kârı hemen cebine koyar.
    ATR çarpanı daha düşüktür (1.5x) bu yüzden daha sık durur.
    """
    
    def name(self) -> str:
        return "Scalper Ninja"

    def description(self) -> str:
        return "5 ve 13 EMA kesişimi ile hızlı Scalp işlemlere odaklanır. Kar hedefleri küçüktür."

    def generate_signal(self, current_row: pd.Series) -> int:
        close_p = current_row['close']
        
        # --- LONG ---
        # 5 EMA'nın 13 EMA'yı yukarı kesmiş olması
        cross_up = current_row.get('EMA_5', 0) > current_row.get('EMA_13', 0)
        # RSI dipte değil ama boğa bölgesinde (45-80)
        momentum = 45 < current_row['RSI_14'] < 80
        
        if cross_up and momentum:
            return 2
            
        # --- SHORT ---
        # 5 EMA'nın 13 EMA'yı aşağı kesmiş olması
        cross_down = current_row.get('EMA_5', 0) < current_row.get('EMA_13', 0)
        # RSI zayıf bölge (20-55)
        momentum = 20 < current_row['RSI_14'] < 55
        
        if cross_down and momentum:
            return 0
            
        return 1

    def get_stop_params(self):
        # ATR daha dar tutulur (Scalp mantığı)
        return {"atr_multiplier": 1.5, "tp_multiplier": 1.5}
