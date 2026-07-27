from strategy.base import BaseStrategy
import pandas as pd
from typing import Dict, Any
from core.logger import logger

class TestToggleStrategy(BaseStrategy):
    """
    Test stratejisi. Her mum kapanışında deterministik olarak bir önceki işlemin tersini açar.
    Çift dakikalarda LONG (2), Tek dakikalarda SHORT (0) üreterek bot motorunun
    Stop & Reverse yeteneğini test eder.
    """
    def __init__(self):
        self.params = {}
        self.last_signal = 0
        
    def name(self) -> str:
        return "test_toggle"

    def description(self) -> str:
        return "Sürekli LONG ve SHORT açıp kapatan sistem test stratejisi. Her mumda pozisyon değiştirir."

    def generate_signal(self, current_row: pd.Series) -> int:
        try:
            if hasattr(current_row, 'name') and current_row.name is not None:
                ts = pd.to_datetime(current_row.name)
            elif 'timestamp' in current_row:
                ts = pd.to_datetime(current_row['timestamp'])
            else:
                ts = pd.Timestamp.now()
            minute = ts.minute
        except Exception:
            self.last_signal = 0 if self.last_signal == 2 else 2
            return self.last_signal

        if minute % 2 == 0:
            logger.info(f"🧪 [TEST TOGGLE] Dakika {minute} (Çift) → LONG (2) sinyali")
            return 2  # LONG
        else:
            logger.info(f"🧪 [TEST TOGGLE] Dakika {minute} (Tek) → SHORT (0) sinyali")
            return 0  # SHORT

    def get_stop_params(self):
        return {
            "atr_multiplier": 5.0,
            "risk_reward": 1.5,
            "risk_reward_ratio": 1.5,
            "tp_multiplier": 5.0,
            "sl_multiplier": 5.0,
            "trailing_stop": False
        }
