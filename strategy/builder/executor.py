"""
Strategy Executor - Strateji çalıştırıcı
JSON stratejisini alıp gerçek sinyaller üretir.
"""

import json
import pandas as pd
import numpy as np
from typing import Dict, Any, Optional
from pathlib import Path

from .strategy_builder import StrategyBuilder
from .condition_parser import ConditionParser
from .json_validator import StrategyValidator


class StrategyExecutor:
    """
    JSON stratejisini çalıştırır ve sinyal üretir.
    
    Kullanım:
    ```python
    executor = StrategyExecutor()
    executor.load_strategy('my_strategy.json')
    signals = executor.generate_signals(df)
    ```
    """
    
    def __init__(self):
        self.strategy = None
        self.parser = None
        self.indicator_mappings = {}
    
    def load_strategy(self, strategy_path: str) -> bool:
        """
        JSON dosyasından strateji yükle
        
        Args:
            strategy_path: JSON dosya yolu
            
        Returns:
            Success (True/False)
        """
        # Validate
        is_valid, errors = StrategyValidator.validate_file(strategy_path)
        if not is_valid:
            raise ValueError(f"Strateji validation hatası: {errors}")
        
        # JSON'u yükle
        with open(strategy_path, 'r', encoding='utf-8') as f:
            self.strategy = json.load(f)
        
        return True
    
    def load_strategy_from_dict(self, strategy_dict: Dict) -> bool:
        """
        Dictionary'den strateji yükle
        
        Args:
            strategy_dict: Strateji dictionary
            
        Returns:
            Success (True/False)
        """
        # Validate
        is_valid, errors = StrategyValidator.validate(strategy_dict)
        if not is_valid:
            raise ValueError(f"Strateji validation hatası: {errors}")
        
        self.strategy = strategy_dict
        return True
    
    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Strateji için gerekli indikatörleri hesapla
        
        Args:
            df: OHLCV DataFrame
            
        Returns:
            DataFrame with all required indicators
        """
        if self.strategy is None:
            raise ValueError("Strateji yüklenmedi")
        
        df = df.copy()
        self.indicator_mappings = {}
        
        # Her indikatör için hesaplama yap
        for indicator in self.strategy['indicators']:
            ind_type = indicator['type']
            ind_id = indicator['id']
            params = indicator.get('parameters', {})
            
            # İndikatörü hesapla
            column_name = self._calculate_indicator(df, ind_type, params)
            
            # Mapping kaydet
            self.indicator_mappings[ind_id] = column_name
        
        return df
    
    def _calculate_indicator(self, df: pd.DataFrame, ind_type: str, 
                            params: Dict) -> str:
        """
        Tek indikatör hesapla
        
        Returns:
            column_name: DataFrame'deki kolon adı
        """
        # İndikatör tipine göre hesapla
        if ind_type == 'RSI':
            column_name = f'RSI_{params.get("length", 14)}'
            if column_name not in df.columns:
                from data.indicators import StrategyIndicators
                df[column_name] = StrategyIndicators.rsi(df['close'], params.get('length', 14))
        
        elif ind_type == 'MACD':
            from data.indicators import StrategyIndicators
            macd_line, signal_line, hist = StrategyIndicators.macd(
                df['close'],
                params.get('fast', 12),
                params.get('slow', 26),
                params.get('signal', 9)
            )
            column_name = f'MACD_{ind_type}'
            df[column_name] = macd_line
            df[f'{column_name}_signal'] = signal_line
            
            # Signal'a referans için mapping güncelle
            self.indicator_mappings['signal'] = f'{column_name}_signal'
        
        elif ind_type == 'EMA':
            column_name = f'EMA_{params.get("length", 20)}'
            if column_name not in df.columns:
                from data.indicators import StrategyIndicators
                df[column_name] = StrategyIndicators.ema(df['close'], params.get('length', 20))
        
        elif ind_type == 'SMA':
            column_name = f'SMA_{params.get("length", 20)}'
            if column_name not in df.columns:
                from data.indicators import StrategyIndicators
                df[column_name] = StrategyIndicators.sma(df['close'], params.get('length', 20))
        
        elif ind_type == 'ATR':
            column_name = f'ATR_{params.get("period", 14)}'
            if column_name not in df.columns:
                from data.indicators import StrategyIndicators
                df[column_name] = StrategyIndicators.atr(
                    df['high'], df['low'], df['close'], 
                    params.get('period', 14)
                )
        
        elif ind_type == 'Bollinger':
            from data.indicators import StrategyIndicators
            upper, middle, lower = StrategyIndicators.bollinger_bands(
                df['close'],
                params.get('length', 20),
                params.get('std', 2.0)
            )
            column_name = f'BB_{ind_type}'
            df[column_name] = upper
            df[f'{column_name}_middle'] = middle
            df[f'{column_name}_lower'] = lower
        
        else:
            # Diğer indikatörler için varsayılan
            column_name = f'{ind_type}_{str(params)}'
            df[column_name] = 0  # Placeholder
        
        return column_name
    
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """
        Sinyal üret
        
        Args:
            df: OHLCV + indicators DataFrame
            
        Returns:
            Signal Series (0=SAT, 1=HOLD, 2=AL)
        """
        if self.strategy is None:
            raise ValueError("Strateji yüklenmedi")
        
        # İndikatörleri hazırla
        df = self.prepare_indicators(df)
        
        # Parser oluştur
        self.parser = ConditionParser(df)
        
        # Indicator mappings'i register et
        for ind_id, column in self.indicator_mappings.items():
            self.parser.register_indicator(ind_id, column)
        
        # Sinyalleri üret
        signals = self.parser.generate_signals(self.strategy['conditions'])
        
        return signals
    
    def get_last_signal(self, df: pd.DataFrame) -> int:
        """
        Son mum için sinyal üret
        
        Args:
            df: OHLCV + indicators DataFrame
            
        Returns:
            Signal (0=SAT, 1=HOLD, 2=AL)
        """
        signals = self.generate_signals(df)
        return signals.iloc[-1] if len(signals) > 0 else 1
    
    def get_strategy_info(self) -> Dict:
        """
        Strateji bilgilerini döndür
        
        Returns:
            Strategy info dictionary
        """
        if self.strategy is None:
            return {}
        
        return {
            'name': self.strategy.get('name', 'Unknown'),
            'description': self.strategy.get('description', ''),
            'timeframe': self.strategy.get('timeframe', '15m'),
            'indicators_count': len(self.strategy.get('indicators', [])),
            'author': self.strategy.get('author', 'Unknown'),
            'version': self.strategy.get('version', '1.0')
        }
    
    def __str__(self) -> str:
        """String representation"""
        if self.strategy is None:
            return "StrategyExecutor (no strategy loaded)"
        
        info = self.get_strategy_info()
        return f"StrategyExecutor: {info['name']} ({info['timeframe']})"
