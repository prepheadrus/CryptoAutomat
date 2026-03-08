"""
Strategy Manager - Strateji Yönetim Sistemi

Sabit stratejiler (TrendMaster, ScalperNinja, vb.) ve
kullanıcı tarafından oluşturulan JSON stratejileri yönetir.
"""

from strategy.trend_master import TrendMasterPro
from strategy.scalper_ninja import ScalperNinja
from strategy.adaptive_koncorde import AdaptiveKoncordeX
from strategy.golden_combo import GoldenCombo
from strategy.divergence_hunter import DivergenceHunter
from strategy.knn_quant import KNNQuantATRShield
from strategy.builder.executor import StrategyExecutor
from core.logger import logger
from pathlib import Path
import json


class StrategyManager:
    """
    Sistemdeki tüm bot (strateji) setlerini bu yönetici üzerinden çağırırız.
    Sabit stratejiler + Kullanıcı JSON stratejileri.
    """

    # Sabit stratejiler
    FIXED_STRATEGIES = {
        "trend_master": TrendMasterPro(),
        "scalper_ninja": ScalperNinja(),
        "adaptive_koncorde": AdaptiveKoncordeX(),
        "golden_combo": GoldenCombo(),
        "divergence_hunter": DivergenceHunter(),
        "knn_quant_atr": KNNQuantATRShield()
    }

    # Dinamik JSON stratejiler (runtime yüklenir)
    DYNAMIC_STRATEGIES = {}

    # StrategyExecutor instances (canlı sinyal üretimi için)
    STRATEGY_EXECUTORS = {}

    # Strateji klasörü
    STRATEGIES_DIR = Path("artifacts/strategies")


    @classmethod
    def load_dynamic_strategies(cls):
        """
        artifacts/strategies/ klasöründen JSON stratejileri yükle.

        Her JSON dosyası için StrategyExecutor instance oluşturur.
        """
        cls.DYNAMIC_STRATEGIES.clear()
        cls.STRATEGY_EXECUTORS.clear()

        # Klasör yoksa oluştur
        if not cls.STRATEGIES_DIR.exists():
            cls.STRATEGIES_DIR.mkdir(parents=True, exist_ok=True)
            logger.info("📁 Strateji klasörü oluşturuldu: artifacts/strategies/")
            return

        # JSON dosyalarını tara
        json_files = list(cls.STRATEGIES_DIR.glob("*.json"))

        if not json_files:
            logger.info("📭 Kaydedilmiş strateji bulunamadı")
            return

        logger.info(f"📚 {len(json_files)} strateji yükleniyor...")

        for filepath in json_files:
            try:
                # JSON'u yükle
                with open(filepath, 'r', encoding='utf-8') as f:
                    strategy_data = json.load(f)

                strategy_name = strategy_data.get('name', 'Bilinmeyen')
                strategy_id = f"dynamic_{filepath.stem}"  # Örn: dynamic_rsi_macd_20260306_143022

                # StrategyExecutor oluştur
                executor = StrategyExecutor(str(filepath))

                # Listeye ekle
                cls.DYNAMIC_STRATEGIES[strategy_id] = {
                    'name': strategy_name,
                    'description': strategy_data.get('description', ''),
                    'filename': filepath.name,
                    'executor': executor,
                    'data': strategy_data
                }

                cls.STRATEGY_EXECUTORS[strategy_id] = executor

                logger.info(f"✅ Strateji yüklendi: {strategy_name} ({filepath.name})")

            except Exception as e:
                logger.error(f"❌ Strateji yüklenemedi: {filepath.name} - {e}")

        logger.info(f"✅ {len(cls.DYNAMIC_STRATEGIES)} dinamik strateji yüklendi")


    @classmethod
    def get_strategy(cls, strategy_id: str):
        """
        Kimliği (id) verilen stratejiyi getirir.

        Önce sabit stratejilere bakar, yoksa dinamiklere bakar.
        Varsayılan: trend_master.
        """
        # Sabit stratejiler
        if strategy_id in cls.FIXED_STRATEGIES:
            return cls.FIXED_STRATEGIES.get(strategy_id)

        # Dinamik stratejiler (StrategyExecutor)
        if strategy_id in cls.STRATEGY_EXECUTORS:
            return cls.STRATEGY_EXECUTORS[strategy_id]

        # Varsayılan
        logger.warning(f"⚠️ Strateji bulunamadı: {strategy_id}. Varsayılan: trend_master")
        return cls.FIXED_STRATEGIES["trend_master"]


    @classmethod
    def get_executor(cls, strategy_id: str):
        """
        StrategyExecutor instance al (canlı sinyal üretimi için).

        Args:
            strategy_id: Strateji ID (dynamic_...)

        Returns:
            StrategyExecutor veya None
        """
        return cls.STRATEGY_EXECUTORS.get(strategy_id)


    @classmethod
    def list_all_strategies(cls):
        """
        Arayüzde gösterilecek tüm bot isim ve açıklamalarını döner.
        Sabit (builtin) + Dinamik (custom) stratejiler.

        Returns:
            list: [
                {
                    "id": "trend_master",
                    "name": "TrendMaster Pro",
                    "description": "...",
                    "type": "builtin",  # builtin veya custom
                    "source": "python"   # python veya json
                },
                ...
            ]
        """
        strategies = []

        # Sabit stratejiler (BUILTIN)
        for key, val in cls.FIXED_STRATEGIES.items():
            strategies.append({
                "id": key,
                "name": val.name(),
                "description": val.description(),
                "type": "builtin",
                "source": "python"
            })

        # Dinamik stratejiler (CUSTOM)
        for key, val in cls.DYNAMIC_STRATEGIES.items():
            strategies.append({
                "id": key,
                "name": val['name'],
                "description": val.get('description') or "Kullanıcı stratejisi",
                "type": "custom",
                "source": "json",
                "filename": val['filename']
            })

        return strategies


    @classmethod
    def generate_signals(cls, df, symbol: str = None):
        """
        Tüm stratejiler için sinyal üret.

        Args:
            df: İndikatörler eklenmiş DataFrame
            symbol: Sembol adı (opsiyonel)

        Returns:
            dict: {
                "trend_master": 1,  # 0=SAT, 1=BEKLE, 2=AL
                "scalper_ninja": 2,
                "dynamic_rsi_macd": 0,
                ...
            }
        """
        signals = {}

        # DataFrame'in son satırını al (Series olarak)
        current_row = df.iloc[-1] if not df.empty else None

        # Sabit stratejiler
        for strategy_id, strategy in cls.FIXED_STRATEGIES.items():
            try:
                if hasattr(strategy, 'generate_signal'):
                    signal = strategy.generate_signal(current_row)
                    signals[strategy_id] = signal
            except Exception as e:
                logger.error(f"❌ {strategy_id} sinyal hatası: {e}")
                signals[strategy_id] = 1  # BEKLE

        # Dinamik stratejiler (StrategyExecutor)
        for strategy_id, executor in cls.STRATEGY_EXECUTORS.items():
            try:
                # Veriyi hazırla (indikatörleri hesapla)
                prepared_df = executor.prepare_data(df.copy())

                # Sinyal üret
                signal = executor.generate_signal(prepared_df)
                signals[strategy_id] = signal

            except Exception as e:
                logger.error(f"❌ {strategy_id} sinyal hatası: {e}")
                signals[strategy_id] = 1  # BEKLE

        return signals


    @classmethod
    def reload_strategies(cls):
        """
        Stratejileri yeniden yükle (hot reload).

        Kullanıcı yeni strateji kaydettiğinde veya sildiğinde çağrılır.
        """
        logger.info("🔄 Stratejiler yeniden yükleniyor...")
        cls.load_dynamic_strategies()
        logger.info("✅ Stratejiler yenilendi")


    @classmethod
    def get_strategy_info(cls, strategy_id: str):
        """
        Strateji detaylı bilgilerini al.

        Args:
            strategy_id: Strateji ID

        Returns:
            dict: Strateji bilgileri veya None
        """
        # Sabit stratejiler
        if strategy_id in cls.FIXED_STRATEGIES:
            strategy = cls.FIXED_STRATEGIES[strategy_id]
            return {
                "id": strategy_id,
                "name": strategy.name(),
                "description": strategy.description(),
                "type": "fixed"
            }

        # Dinamik stratejiler
        if strategy_id in cls.DYNAMIC_STRATEGIES:
            strategy = cls.DYNAMIC_STRATEGIES[strategy_id]
            return {
                "id": strategy_id,
                "name": strategy['name'],
                "description": strategy['description'],
                "type": "dynamic",
                "filename": strategy['filename'],
                "indicators": strategy['data'].get('indicators', []),
                "risk": strategy['data'].get('risk', {})
            }

        return None
