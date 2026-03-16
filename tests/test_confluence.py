import pandas as pd
import pytest
from strategy.confluence import StrategyConfluence

def test_check_trend_following_signal_missing_cols():
    """Test with missing required columns, should return neutral (1)"""
    data = pd.Series({'close': 100, 'SMA_20': 90})
    assert StrategyConfluence.check_trend_following_signal(data) == 1

def test_check_trend_following_signal_long():
    """Test for LONG signal (2)"""
    data = pd.Series({
        'close': 110,
        'SMA_20': 100,
        'EMA_50': 95,
        'EMA_200': 90,
        'RSI_14': 60,
        'VWAP': 105
    })
    # close > EMA_200 (110 > 90) AND close > SMA_20 (110 > 100) -> trend_up = True
    # 50 < RSI_14 < 70 (50 < 60 < 70) -> mom_up = True
    # signal should be 2
    assert StrategyConfluence.check_trend_following_signal(data) == 2

def test_check_trend_following_signal_short():
    """Test for SHORT signal (0)"""
    data = pd.Series({
        'close': 80,
        'SMA_20': 90,
        'EMA_50': 95,
        'EMA_200': 100,
        'RSI_14': 40,
        'VWAP': 85
    })
    # close < EMA_200 (80 < 100) AND close < SMA_20 (80 < 90) -> trend_down = True
    # 30 < RSI_14 < 50 (30 < 40 < 50) -> mom_down = True
    # signal should be 0
    assert StrategyConfluence.check_trend_following_signal(data) == 0

def test_check_trend_following_signal_neutral_rsi_too_high():
    """Test LONG trend but RSI too high (overbought), should return neutral (1)"""
    data = pd.Series({
        'close': 110,
        'SMA_20': 100,
        'EMA_50': 95,
        'EMA_200': 90,
        'RSI_14': 75,
        'VWAP': 105
    })
    # trend_up = True, but RSI_14 > 70
    assert StrategyConfluence.check_trend_following_signal(data) == 1

def test_check_trend_following_signal_neutral_rsi_too_low():
    """Test LONG trend but RSI too low, should return neutral (1)"""
    data = pd.Series({
        'close': 110,
        'SMA_20': 100,
        'EMA_50': 95,
        'EMA_200': 90,
        'RSI_14': 45,
        'VWAP': 105
    })
    # trend_up = True, but RSI_14 < 50
    assert StrategyConfluence.check_trend_following_signal(data) == 1

def test_check_trend_following_signal_neutral_mixed_trend():
    """Test mixed trend indicators, should return neutral (1)"""
    data = pd.Series({
        'close': 95,
        'SMA_20': 100,
        'EMA_50': 95,
        'EMA_200': 90,
        'RSI_14': 60,
        'VWAP': 105
    })
    # close > EMA_200 (95 > 90) but close < SMA_20 (95 < 100) -> trend_up = False
    # mom_up = True (60)
    assert StrategyConfluence.check_trend_following_signal(data) == 1

def test_is_volatility_safe_missing_atr():
    """Test with missing ATR_14, should return True by default"""
    data = pd.Series({'close': 100})
    assert StrategyConfluence.is_volatility_safe(data) is True

def test_is_volatility_safe_true():
    """Test safe volatility ratio"""
    data = pd.Series({'close': 100, 'ATR_14': 4})
    # 4 / 100 = 0.04 < 0.05
    assert StrategyConfluence.is_volatility_safe(data) is True

def test_is_volatility_safe_false():
    """Test unsafe volatility ratio"""
    data = pd.Series({'close': 100, 'ATR_14': 6})
    # 6 / 100 = 0.06 > 0.05
    assert StrategyConfluence.is_volatility_safe(data) is False

def test_is_volatility_safe_custom_factor():
    """Test volatility safety with custom max factor"""
    data = pd.Series({'close': 100, 'ATR_14': 4})
    # 4 / 100 = 0.04 > 0.03
    assert StrategyConfluence.is_volatility_safe(data, max_atr_factor=0.03) is False
