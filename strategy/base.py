from abc import ABC, abstractmethod
import pandas as pd

class BaseStrategy(ABC):
    """
    Tüm bot stratejileri için ortak şablon. 
    Yeni bir bot eklemek için bu sınıftan türetmek yeterli.
    """
    
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def description(self) -> str:
        pass

    @abstractmethod
    def generate_signal(self, current_row: pd.Series) -> int:
        """
        2: LONG, 0: SHORT, 1: HOLD
        """
        pass

    @abstractmethod
    def get_stop_params(self):
        """
        ATR çarpanı ve Risk/Ödül oranı gibi parametreleri döner.
        """
        pass
