"""
Condition Parser - Koşul Parser ve Evaluator
JSON strateji tanımını çalıştırılabilir koşullara dönüştürür.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union
from data.indicators import StrategyIndicators


class ConditionParser:
    """
    JSON strateji koşullarını parser ve evaluate eder.
    
    Örnek:
    {
        "indicator": "rsi_1",
        "operator": "<",
        "value": 30
    }
    → df['rsi_1'] < 30
    """
    
    def __init__(self, df: pd.DataFrame):
        """
        Args:
            df: OHLCV + indicators DataFrame
        """
        self.df = df.copy()
        self.indicators_map = {}  # indicator_id → column_name
    
    def register_indicator(self, indicator_id: str, column_name: str) -> None:
        """
        İndikatör ID'sini DataFrame kolonu ile eşle
        
        Args:
            indicator_id: Strateji JSON'daki ID
            column_name: DataFrame'deki kolon adı
        """
        self.indicators_map[indicator_id] = column_name
    
    def evaluate_rule(self, rule: Dict) -> pd.Series:
        """
        Tek bir koşulu evaluate eder
        
        Args:
            rule: {"indicator": "rsi_1", "operator": "<", "value": 30}
            
        Returns:
            Boolean Series (True/False for each row)
        """
        indicator_id = rule['indicator']
        operator = rule['operator']
        value = rule['value']
        
        # İndikatör kolonunu bul
        if indicator_id in self.indicators_map:
            column = self.indicators_map[indicator_id]
        else:
            # Doğrudan kolon adı olabilir
            column = indicator_id
        
        # Değeri al (başka indikatör olabilir)
        if isinstance(value, str) and value in self.indicators_map:
            value_series = self.df[self.indicators_map[value]]
            compare_value = None
        else:
            value_series = None
            compare_value = value
        
        # İndikatör değerini al
        if column not in self.df.columns:
            raise ValueError(f"Kolon bulunamadı: {column}")
        
        indicator_series = self.df[column]
        
        # Operatörü uygula
        if compare_value is not None:
            if operator == '<':
                return indicator_series < compare_value
            elif operator == '>':
                return indicator_series > compare_value
            elif operator == '=':
                return indicator_series == compare_value
            elif operator == '<=':
                return indicator_series <= compare_value
            elif operator == '>=':
                return indicator_series >= compare_value
        else:
            # Başka indikatör ile karşılaştırma
            if operator == '<':
                return indicator_series < value_series
            elif operator == '>':
                return indicator_series > value_series
            elif operator == '=':
                return indicator_series == value_series
            elif operator == '<=':
                return indicator_series <= value_series
            elif operator == '>=':
                return indicator_series >= value_series
        
        raise ValueError(f"Geçersiz operatör: {operator}")
    
    def evaluate_conditions(self, conditions: Dict, side: str) -> pd.Series:
        """
        Tüm koşulları evaluate eder (LONG veya SHORT)
        
        Args:
            conditions: Strateji JSON'daki conditions
            side: 'long' veya 'short'
            
        Returns:
            Boolean Series (True = signal)
        """
        if side not in ['long', 'short']:
            raise ValueError("side 'long' veya 'short' olmalı")
        
        side_conditions = conditions.get(side, {'logic': 'AND', 'rules': []})
        rules = side_conditions.get('rules', [])
        logic = side_conditions.get('logic', 'AND')
        
        if not rules:
            return pd.Series(False, index=self.df.index)
        
        # Her koşulu evaluate et
        results = []
        for rule in rules:
            result = self.evaluate_rule(rule)
            results.append(result)
        
        # Mantıksal operatörü uygula
        if logic == 'AND':
            # Tüm koşullar True olmalı
            final_result = results[0]
            for result in results[1:]:
                final_result = final_result & result
        elif logic == 'OR':
            # En az bir koşul True olmalı
            final_result = results[0]
            for result in results[1:]:
                final_result = final_result | result
        else:
            raise ValueError(f"Geçersiz logic: {logic}")
        
        return final_result
    
    def generate_signals(self, conditions: Dict) -> pd.Series:
        """
        Sinyal üretir (0=SAT, 1=HOLD, 2=AL)
        
        Args:
            conditions: Strateji JSON'daki conditions
            
        Returns:
            Signal Series (0, 1, 2)
        """
        # Başlangıçta tüm HOLD
        signals = pd.Series(1, index=self.df.index, dtype=int)
        
        # LONG koşulları
        long_signals = self.evaluate_conditions(conditions, 'long')
        signals[long_signals] = 2  # AL
        
        # SHORT koşulları (LONG'u ezer)
        short_signals = self.evaluate_conditions(conditions, 'short')
        signals[short_signals] = 0  # SAT
        
        return signals
