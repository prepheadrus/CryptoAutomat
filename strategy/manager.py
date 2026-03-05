from strategy.trend_master import TrendMasterPro
from strategy.scalper_ninja import ScalperNinja
from strategy.adaptive_koncorde import AdaptiveKoncordeX
from strategy.golden_combo import GoldenCombo
from strategy.divergence_hunter import DivergenceHunter
from strategy.knn_quant import KNNQuantATRShield

class StrategyManager:
    """
    Sistemdeki tüm bot (strateji) setlerini bu yönetici üzerinden çağırırız.
    """
    STRATEGIES = {
        "trend_master": TrendMasterPro(),
        "scalper_ninja": ScalperNinja(),
        "adaptive_koncorde": AdaptiveKoncordeX(),
        "golden_combo": GoldenCombo(),
        "divergence_hunter": DivergenceHunter(),
        "knn_quant_atr": KNNQuantATRShield()
    }


    @classmethod
    def get_strategy(cls, strategy_id: str):
        """
        Kimliği (id) verilen stratejiyi getirir. Varsayılan: trend_master.
        """
        return cls.STRATEGIES.get(strategy_id, cls.STRATEGIES["trend_master"])
    
    @classmethod
    def list_all_strategies(cls):
        """
        Arayüzde gösterilecek tüm bot isim ve açıklamalarını döner.
        """
        return [
            {"id": key, "name": val.name(), "desc": val.description()}
            for key, val in cls.STRATEGIES.items()
        ]
