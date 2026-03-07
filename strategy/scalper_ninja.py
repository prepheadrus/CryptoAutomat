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
        return "Aşırı satım (Oversold) koşullarında (RSI < 30, Stoch < 20) hızlı dip avcılığına odaklanır."

    def generate_signal(self, current_row: pd.Series) -> int:
        """
        Sinyal Üretimi
        2: LONG (AL)
        0: SHORT (SAT) -> Bu stratejide kullanılmıyor
        1: HOLD (BEKLE)
        """
        # Gerekli sütunların varlığını ve geçerli bir değere sahip olduğunu kontrol et
        required_cols = ['RSI_14', 'STOCH_K_14_3_3']
        if not all(col in current_row and pd.notna(current_row[col]) for col in required_cols):
            return 1 # Veri eksikse bekle

        # --- LONG (Dipten Al) Şartı ---
        is_rsi_oversold = current_row['RSI_14'] < 30
        is_stoch_oversold = current_row['STOCH_K_14_3_3'] < 20
        
        # Her iki koşul da sağlandığında LONG sinyali üret
        if is_rsi_oversold and is_stoch_oversold:
            return 2
            
        # Bu strateji sadece LONG yönlü çalışır, SHORT sinyali üretmez.
        return 1

    def get_stop_params(self):
        # ATR daha dar tutulur (Scalp mantığı)
        return {"atr_multiplier": 1.5, "tp_multiplier": 1.5}
