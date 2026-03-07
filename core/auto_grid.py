"""
Auto-Grid Generator

Bu modül, strateji parametreleri için otomatik optimizasyon ızgaraları (grid) oluşturur.
İki tür stratejiyi destekler:
1. Python Tabanlı Stratejiler: DEFAULT_PARAMS sözlüğünden introspection yapar
2. No-Code (JSON) Stratejiler: Indikatör isimlerini okuyarak auto-mapping yapar

Mimari:
- Python stratejileri için: %30 esnetme ile 3'lü arama uzayları
- No-Code stratejiler için: Indikatör bazlı mantıklı aralıklar
- Tamamen otomatik - manuel PARAM_GRID tanımlamaya gerek yok
"""

import inspect
from typing import Dict, Any, List, Optional, Type
from core.logger import logger


class AutoGridGenerator:
    """
    Otomatik Parametre Izgarası Oluşturucu
    
    Strateji sınıflarını analiz ederek WFO için optimize edilebilir
    parametre aralıklarını otomatik olarak oluşturur.
    """
    
    # No-Code stratejiler için indikatör bazlı varsayılan aralıklar
    INDICATOR_RANGES = {
        # RSI (Relative Strength Index)
        'rsi': {'min': 10, 'max': 50, 'step_type': 'int'},
        'rsi_period': {'min': 10, 'max': 30, 'step_type': 'int'},
        'rsi_upper': {'min': 50, 'max': 80, 'step_type': 'int'},
        'rsi_lower': {'min': 20, 'max': 40, 'step_type': 'int'},
        
        # MACD (Moving Average Convergence Divergence)
        'macd': {'min': 8, 'max': 35, 'step_type': 'int'},
        'macd_fast': {'min': 8, 'max': 16, 'step_type': 'int'},
        'macd_slow': {'min': 20, 'max': 35, 'step_type': 'int'},
        'macd_signal': {'min': 7, 'max': 15, 'step_type': 'int'},
        
        # EMA (Exponential Moving Average)
        'ema': {'min': 5, 'max': 200, 'step_type': 'int'},
        'ema_fast': {'min': 5, 'max': 34, 'step_type': 'int'},
        'ema_slow': {'min': 50, 'max': 200, 'step_type': 'int'},
        
        # SMA (Simple Moving Average)
        'sma': {'min': 10, 'max': 200, 'step_type': 'int'},
        'sma_period': {'min': 10, 'max': 100, 'step_type': 'int'},
        
        # ATR (Average True Range)
        'atr': {'min': 1.0, 'max': 5.0, 'step_type': 'float'},
        'atr_multiplier': {'min': 1.5, 'max': 4.0, 'step_type': 'float'},
        
        # Bollinger Bands
        'bb': {'min': 1.5, 'max': 3.0, 'step_type': 'float'},
        'bb_std': {'min': 1.5, 'max': 3.0, 'step_type': 'float'},
        'bb_period': {'min': 14, 'max': 30, 'step_type': 'int'},
        
        # Stochastic
        'stoch': {'min': 10, 'max': 40, 'step_type': 'int'},
        'stoch_k': {'min': 10, 'max': 25, 'step_type': 'int'},
        'stoch_d': {'min': 10, 'max': 25, 'step_type': 'int'},
        'stoch_oversold': {'min': 15, 'max': 30, 'step_type': 'int'},
        'stoch_overbought': {'min': 70, 'max': 85, 'step_type': 'int'},
        
        # Take Profit / Stop Loss
        'tp': {'min': 1.0, 'max': 3.0, 'step_type': 'float'},
        'tp_multiplier': {'min': 1.0, 'max': 3.0, 'step_type': 'float'},
        'sl': {'min': 1.0, 'max': 5.0, 'step_type': 'float'},
        'sl_multiplier': {'min': 1.5, 'max': 5.0, 'step_type': 'float'},
        
        # Volume
        'volume': {'min': 10, 'max': 100, 'step_type': 'int'},
        'volume_period': {'min': 10, 'max': 50, 'step_type': 'int'},
        
        # ADX
        'adx': {'min': 14, 'max': 30, 'step_type': 'int'},
        'adx_period': {'min': 14, 'max': 28, 'step_type': 'int'},
        
        # CCI
        'cci': {'min': 10, 'max': 50, 'step_type': 'int'},
        'cci_period': {'min': 14, 'max': 30, 'step_type': 'int'},
        
        # Williams %R
        'williams': {'min': 10, 'max': 40, 'step_type': 'int'},
        'williams_period': {'min': 14, 'max': 30, 'step_type': 'int'},
        
        # Ichimoku
        'ichimoku': {'min': 9, 'max': 52, 'step_type': 'int'},
        'tenkan': {'min': 7, 'max': 15, 'step_type': 'int'},
        'kijun': {'min': 20, 'max': 30, 'step_type': 'int'},
        'senkou': {'min': 40, 'max': 60, 'step_type': 'int'},
    }
    
    # Varsayılan aralık (bilinmeyen parametreler için)
    DEFAULT_RANGE = {'min': 1, 'max': 100, 'step_type': 'int'}
    
    # Esnetme oranı (%30)
    FLEX_RATIO = 0.30
    
    def __init__(self):
        """Auto-Grid Generator'ı başlatır."""
        logger.info("🤖 Auto-Grid Generator başlatıldı")
    
    def generate_from_python_strategy(
        self,
        strategy_class: Type,
        use_flex: bool = True
    ) -> Dict[str, List[Any]]:
        """
        Python tabanlı strateji sınıfından otomatik parametre ızgarası oluşturur.
        
        Args:
            strategy_class: Strateji sınıfı (örn: TrendMasterPro)
            use_flex: %30 esnetme kullanılsın mı?
            
        Returns:
            Dict: Parametre ızgarası
        """
        param_grid = {}
        
        # 1. DEFAULT_PARAMS sözlüğünü al
        default_params = getattr(strategy_class, 'DEFAULT_PARAMS', None)
        
        if default_params is None:
            logger.warning(f"⚠️ {strategy_class.__name__} için DEFAULT_PARAMS bulunamadı!")
            # Fallback: INDICATOR_RANGES'ten tahmin et
            return self._generate_from_class_name(strategy_class)
        
        logger.info(f"📊 {strategy_class.__name__} DEFAULT_PARAMS analizi: {len(default_params)} parametre")
        
        # 2. Her parametre için 3'lü arama uzayı oluştur
        for param_name, default_value in default_params.items():
            if isinstance(default_value, (int, float)):
                if use_flex:
                    # %30 esnetme
                    values = self._create_flex_range(default_value, param_name)
                else:
                    # Sabit aralık
                    values = self._create_fixed_range(default_value, param_name)
                
                param_grid[param_name] = values
                logger.debug(f"  📍 {param_name}: {default_value} → {values}")
            else:
                # Rakamsal olmayan parametreler (string, bool, vs.)
                logger.debug(f"  ⚠️ {param_name} rakamsal değil, atlanıyor")
        
        logger.info(f"✅ {strategy_class.__name__} için {len(param_grid)} parametre ızgarası oluşturuldu")
        
        return param_grid
    
    def generate_from_json_strategy(
        self,
        strategy_config: Dict[str, Any]
    ) -> Dict[str, List[Any]]:
        """
        No-Code (JSON) strateji konfigürasyonundan otomatik parametre ızgarası oluşturur.
        
        Args:
            strategy_config: JSON strateji konfigürasyonu
            
        Returns:
            Dict: Parametre ızgarası
        """
        param_grid = {}
        
        # 1. Stratejide kullanılan indikatörleri bul
        indicators = self._extract_indicators_from_config(strategy_config)
        
        logger.info(f"📊 No-Code strateji analizi: {len(indicators)} indikatör bulundu")
        
        # 2. Her indikatör için mantıklı aralıklar ata
        for indicator_name, indicator_params in indicators.items():
            # Indikatör adını normalize et (küçük harf, underscore)
            normalized_name = indicator_name.lower().replace(' ', '_').replace('-', '_')
            
            # INDICATOR_RANGES'te ara
            range_config = self._find_matching_range(normalized_name)
            
            if range_config:
                # 3'lü arama uzayı oluştur
                values = self._create_range_values(
                    range_config['min'],
                    range_config['max'],
                    range_config['step_type']
                )
                
                # Parametre adını oluştur
                param_name = self._create_param_name(normalized_name, indicator_params)
                param_grid[param_name] = values
                
                logger.debug(f"  📍 {param_name}: {values}")
        
        logger.info(f"✅ No-Code strateji için {len(param_grid)} parametre ızgarası oluşturuldu")
        
        return param_grid
    
    def _create_flex_range(
        self,
        default_value: float,
        param_name: str
    ) -> List[Any]:
        """
        Varsayılan değerin %30 etrafında 3'lü arama uzayı oluşturur.
        
        Args:
            default_value: Varsayılan değer
            param_name: Parametre adı
            
        Returns:
            List: 3 değerli liste [düşük, orta, yüksek]
        """
        # Alt sınır: %30 düşük
        low = default_value * (1 - self.FLEX_RATIO)
        # Orta: Varsayılan değer
        mid = default_value
        # Üst sınır: %30 yüksek
        high = default_value * (1 + self.FLEX_RATIO)
        
        # Tip kontrolü (int vs float)
        if isinstance(default_value, int):
            return [int(low), int(mid), int(high)]
        else:
            return [round(low, 2), round(mid, 2), round(high, 2)]
    
    def _create_fixed_range(
        self,
        default_value: float,
        param_name: str
    ) -> List[Any]:
        """
        INDICATOR_RANGES'ten sabit aralık oluşturur.
        
        Args:
            default_value: Varsayılan değer
            param_name: Parametre adı
            
        Returns:
            List: 3 değerli liste
        """
        range_config = self._find_matching_range(param_name)
        
        if range_config:
            return self._create_range_values(
                range_config['min'],
                range_config['max'],
                range_config['step_type']
            )
        else:
            # Varsayılan aralık
            return self._create_range_values(
                self.DEFAULT_RANGE['min'],
                self.DEFAULT_RANGE['max'],
                self.DEFAULT_RANGE['step_type']
            )
    
    def _create_range_values(
        self,
        min_val: float,
        max_val: float,
        step_type: str
    ) -> List[Any]:
        """
        Min-max aralığında 3 eşit aralıklı değer oluşturur.
        
        Args:
            min_val: Minimum değer
            max_val: Maksimum değer
            step_type: 'int' veya 'float'
            
        Returns:
            List: 3 değerli liste
        """
        step = (max_val - min_val) / 2
        
        if step_type == 'float':
            return [
                round(min_val, 2),
                round(min_val + step, 2),
                round(max_val, 2)
            ]
        else:
            return [
                int(min_val),
                int(min_val + step),
                int(max_val)
            ]
    
    def _find_matching_range(self, param_name: str) -> Optional[Dict]:
        """
        Parametre adına uygun aralık konfigürasyonunu bulur.
        
        Args:
            param_name: Parametre adı
            
        Returns:
            Dict: Aralık konfigürasyonu veya None
        """
        # Tam eşleşme ara
        if param_name in self.INDICATOR_RANGES:
            return self.INDICATOR_RANGES[param_name]
        
        # Kısmi eşleşme ara (contains)
        for key, value in self.INDICATOR_RANGES.items():
            if key in param_name or param_name in key:
                return value
        
        return None
    
    def _create_param_name(
        self,
        indicator_name: str,
        indicator_params: Dict
    ) -> str:
        """
        Indikatör parametresi için standart parametre adı oluşturur.
        
        Args:
            indicator_name: Indikatör adı
            indicator_params: Indikatör parametreleri
            
        Returns:
            str: Parametre adı
        """
        # Basit mapping
        if 'period' in indicator_params or 'length' in indicator_params:
            return f"{indicator_name}_period"
        elif 'multiplier' in indicator_params:
            return f"{indicator_name}_multiplier"
        else:
            return indicator_name
    
    def _extract_indicators_from_config(
        self,
        strategy_config: Dict[str, Any]
    ) -> Dict[str, Dict]:
        """
        JSON strateji konfigürasyonundan kullanılan indikatörleri çıkarır.
        
        Args:
            strategy_config: JSON strateji konfigürasyonu
            
        Returns:
            Dict: {indikatör_adı: parametreler}
        """
        indicators = {}
        
        # Long koşullarını tara
        long_conditions = strategy_config.get('long_conditions', [])
        for condition in long_conditions:
            indicator = condition.get('indicator')
            if indicator:
                indicators[indicator] = condition.get('params', {})
        
        # Short koşullarını tara
        short_conditions = strategy_config.get('short_conditions', [])
        for condition in short_conditions:
            indicator = condition.get('indicator')
            if indicator:
                indicators[indicator] = condition.get('params', {})
        
        return indicators
    
    def _generate_from_class_name(
        self,
        strategy_class: Type
    ) -> Dict[str, List[Any]]:
        """
        Sınıf adından tahmin yürüterak parametre ızgarası oluşturur.
        (Fallback metod)
        
        Args:
            strategy_class: Strateji sınıfı
            
        Returns:
            Dict: Parametre ızgarası
        """
        class_name = strategy_class.__name__.lower()
        
        # Sınıf adına göre tahmin
        if 'trend' in class_name:
            # Trend takip eden stratejiler
            return {
                'rsi_period': [10, 14, 20],
                'ema_fast': [13, 21, 34],
                'ema_slow': [100, 150, 200],
                'atr_multiplier': [2.5, 3.0, 3.5]
            }
        elif 'scalp' in class_name:
            # Scalping stratejileri
            return {
                'rsi_period': [10, 14, 20],
                'rsi_oversold': [20, 25, 30],
                'stoch_oversold': [15, 20, 25],
                'atr_multiplier': [1.0, 1.5, 2.0]
            }
        elif 'mean' in class_name or 'reversion' in class_name:
            # Mean reversion stratejileri
            return {
                'rsi_period': [10, 14, 20],
                'bb_std': [1.5, 2.0, 2.5],
                'bb_period': [14, 20, 30]
            }
        else:
            # Genel amaçlı
            return {
                'rsi_period': [10, 14, 20],
                'ema_fast': [13, 21, 34],
                'atr_multiplier': [2.0, 2.5, 3.0]
            }


# Global instance
_auto_grid = None


def get_auto_grid() -> AutoGridGenerator:
    """
    Auto-Grid Generator instance'ını alır (yoksa oluşturur).
    
    Returns:
        AutoGridGenerator: Auto-Grid instance
    """
    global _auto_grid
    if _auto_grid is None:
        _auto_grid = AutoGridGenerator()
    return _auto_grid


def generate_param_grid(
    strategy_class: Type = None,
    strategy_config: Dict = None
) -> Dict[str, List[Any]]:
    """
    Kolay kullanım için helper fonksiyon.
    
    Args:
        strategy_class: Python strateji sınıfı
        strategy_config: JSON strateji konfigürasyonu
        
    Returns:
        Dict: Parametre ızgarası
    """
    auto_grid = get_auto_grid()
    
    if strategy_class:
        return auto_grid.generate_from_python_strategy(strategy_class)
    elif strategy_config:
        return auto_grid.generate_from_json_strategy(strategy_config)
    else:
        logger.error("❌ Auto-Grid: strategy_class veya strategy_config gerekli!")
        return {}
