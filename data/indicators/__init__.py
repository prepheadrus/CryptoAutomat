"""
Data Indicators Package

Modüler teknik indikatör kütüphanesi.
Geriye dönük uyumluluk için StrategyIndicators sınıfını sağlar.

Usage:
    from data.indicators import StrategyIndicators
    
    # Eski kullanım hala çalışır
    df = StrategyIndicators.add_all_indicators(df)
    df['EMA_20'] = StrategyIndicators.ema(df['close'], 20)
    
    # Yeni modüler kullanım
    from data.indicators.trend import TrendIndicators
    from data.indicators.momentum import MomentumIndicators
    
    df['EMA_20'] = TrendIndicators.ema(df['close'], 20)
    df['RSI_14'] = MomentumIndicators.rsi(df['close'], 14)
"""

import pandas as pd
import numpy as np

# Import all sub-modules
from data.indicators.trend import TrendIndicators
from data.indicators.momentum import MomentumIndicators
from data.indicators.volatility import VolatilityIndicators
from data.indicators.volume import VolumeIndicators
from data.indicators.advanced import AdvancedIndicators

# Try to import TA-Lib or pandas_ta
try:
    import talib as ta
    USING_TALIB = True
    USING_PANDAS_TA = False
except ImportError:
    try:
        import pandas_ta as ta
        USING_TALIB = False
        USING_PANDAS_TA = True
    except ImportError:
        ta = None
        USING_TALIB = False
        USING_PANDAS_TA = False
        import warnings
        warnings.warn(
            "⚠️ Ne TA-Lib ne pandas_ta bulunamadı! Manuel hesaplama kullanılacak.\n"
            "Kurulum için: sudo apt-get install libta-lib-dev && pip install TA-Lib",
            UserWarning
        )


# ============================================================================
# STRATEGY INDICATORS CLASS (Facade Pattern - Geriye Dönük Uyumluluk)
# ============================================================================

class StrategyIndicators:
    """
    Facade class for backward compatibility.
    
    Eski kodların çalışmaya devam etmesi için tüm indikatör
    metodlarını bu sınıfta topluyoruz. Arka planda alt modülleri
    kullanır.
    """
    
    # ========================================================================
    # BASIC INDICATORS (Wrapper methods)
    # ========================================================================
    
    @staticmethod
    def ema(series: pd.Series, length: int) -> pd.Series:
        """Exponential Moving Average"""
        return TrendIndicators.ema(series, length)
    
    @staticmethod
    def sma(series: pd.Series, length: int) -> pd.Series:
        """Simple Moving Average"""
        return TrendIndicators.sma(series, length)
    
    @staticmethod
    def rsi(series: pd.Series, length: int = 14) -> pd.Series:
        """RSI"""
        return MomentumIndicators.rsi(series, length)
    
    @staticmethod
    def atr(high: pd.Series, low: pd.Series, close: pd.Series, length: int = 14) -> pd.Series:
        """ATR"""
        return VolatilityIndicators.atr(high, low, close, length)
    
    @staticmethod
    def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple:
        """MACD"""
        return MomentumIndicators.macd(series, fast, slow, signal)
    
    @staticmethod
    def bollinger_bands(series: pd.Series, length: int = 20, std: float = 2) -> tuple:
        """Bollinger Bands"""
        return VolatilityIndicators.bollinger_bands(series, length, std)
    
    @staticmethod
    def vwap(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series) -> pd.Series:
        """VWAP"""
        return VolumeIndicators.vwap(high, low, close, volume)
    
    @staticmethod
    def mfi(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, period: int = 14) -> pd.Series:
        """MFI"""
        return VolumeIndicators.mfi(high, low, close, volume, period)
    
    @staticmethod
    def uo(high: pd.Series, low: pd.Series, close: pd.Series, fast: int = 7, medium: int = 14, slow: int = 28) -> pd.Series:
        """Ultimate Oscillator"""
        return MomentumIndicators.uo(high, low, close, fast, medium, slow)
    
    @staticmethod
    def psar(high: pd.Series, low: pd.Series, close: pd.Series = None, af0: float = 0.02, af: float = 0.02, max_af: float = 0.2) -> tuple:
        """Parabolic SAR"""
        return TrendIndicators.psar(high, low, close, af0, af, max_af)
    
    @staticmethod
    def supertrend(high: pd.Series, low: pd.Series, close: pd.Series, multiplier: float = 3.0, period: int = 10) -> tuple:
        """SuperTrend"""
        return TrendIndicators.supertrend(high, low, close, multiplier, period)
    
    # ========================================================================
    # RESAMPLING
    # ========================================================================
    
    @staticmethod
    def resample_data(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
        """
        1 dakikalık verileri istenen zaman dilimine dönüştür.
        
        Args:
            df: 1m DataFrame
            timeframe: Hedef timeframe (3m, 5m, 15m, 1h, vb.)
        
        Returns:
            Resampled DataFrame
        """
        if df.empty or timeframe == "1m":
            return df
        
        # Zaman damgasını index yap
        if 'timestamp' in df.columns:
            if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
        
        # Resample kuralları
        logic = {
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }
        
        # Pandas resample formatına çevir
        if timeframe.endswith('m'):
            rule = timeframe.replace('m', 'min')
        elif timeframe.endswith('h'):
            rule = timeframe.replace('h', 'h')
        elif timeframe.endswith('d'):
            rule = timeframe.replace('d', 'D')
        else:
            rule = timeframe
        
        # Yeniden örnekle
        resampled_df = df.resample(rule, label='left', closed='left').apply(logic)
        
        # Eksik mumları doldur
        resampled_df['volume'] = resampled_df['volume'].fillna(0)
        resampled_df.ffill(inplace=True)
        
        # Index'i tekrar sütuna al
        resampled_df.reset_index(inplace=True)
        return resampled_df
    
    # ========================================================================
    # ADD ALL INDICATORS (Monolithic method - geriye dönük uyumluluk)
    # ========================================================================
    
    @staticmethod
    def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """
        Tüm indikatörleri hesapla (geriye dönük uyumluluk için).
        
        Args:
            df: OHLCV DataFrame
        
        Returns:
            DataFrame with all indicators
        """
        if df.empty or len(df) < 5:
            return df
        
        # Veri kalitesini garanti altına al
        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
        
        # VWAP için DatetimeIndex şart
        if 'timestamp' in df.columns:
            if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True, drop=False)
        
        # Null'ları temizle
        df.ffill(inplace=True)
        df.bfill(inplace=True)
        
        if df['close'].isnull().any():
            df.fillna(0, inplace=True)
        
        # --- TREND ---
        if USING_TALIB:
            df['EMA_5'] = ta.EMA(df['close'], timeperiod=5)
            df['EMA_13'] = ta.EMA(df['close'], timeperiod=13)
            df['SMA_20'] = ta.SMA(df['close'], timeperiod=20)
            df['EMA_50'] = ta.EMA(df['close'], timeperiod=50)
            df['EMA_200'] = ta.EMA(df['close'], timeperiod=200)
        elif USING_PANDAS_TA:
            df['EMA_5'] = ta.ema(df['close'], length=5)
            df['EMA_13'] = ta.ema(df['close'], length=13)
            df['SMA_20'] = ta.sma(df['close'], length=20)
            df['EMA_50'] = ta.ema(df['close'], length=50)
            df['EMA_200'] = ta.ema(df['close'], length=200)
        else:
            df['EMA_5'] = TrendIndicators.ema(df['close'], 5)
            df['EMA_13'] = TrendIndicators.ema(df['close'], 13)
            df['SMA_20'] = TrendIndicators.sma(df['close'], 20)
            df['EMA_50'] = TrendIndicators.ema(df['close'], 50)
            df['EMA_200'] = TrendIndicators.ema(df['close'], 200)
        
        # Kalman Filter
        df['KALMAN'] = TrendIndicators.kalman_filter(df['close'])
        
        # Supertrend
        st, direction = TrendIndicators.supertrend(df['high'], df['low'], df['close'], 3.0, 10)
        df['SUPERTREND'] = st
        df['SUPERTREND_DIR'] = direction
        
        # EWO
        df['EWO'] = AdvancedIndicators.ewo(df['close'])
        
        # --- MOMENTUM ---
        if USING_TALIB:
            df['RSI_14'] = ta.RSI(df['close'], timeperiod=14)
        elif USING_PANDAS_TA:
            df['RSI_14'] = ta.rsi(df['close'], length=14)
        else:
            df['RSI_14'] = MomentumIndicators.rsi(df['close'], 14)
        
        # BTC VIX
        df['BTC_VIX'] = VolatilityIndicators.btc_vix(df['close'])
        
        # MACD
        if USING_TALIB:
            macd, signal, hist = ta.MACD(df['close'], fastperiod=12, slowperiod=26, signalperiod=9)
            df['MACD_12_26_9'] = macd
            df['MACDs_12_26_9'] = signal
            df['MACDh_12_26_9'] = hist
        elif USING_PANDAS_TA:
            macd, signal, hist = ta.macd(df['close'], fast=12, slow=26, signal=9)
            df['MACD_12_26_9'] = macd
            df['MACDs_12_26_9'] = signal
            df['MACDh_12_26_9'] = hist
        else:
            macd_line, signal_line, hist = MomentumIndicators.macd(df['close'])
            df['MACD_12_26_9'] = macd_line
            df['MACDs_12_26_9'] = signal_line
            df['MACDh_12_26_9'] = hist
        
        # --- VOLATILITY ---
        if USING_TALIB:
            df['ATR_14'] = ta.ATR(df['high'], df['low'], df['close'], timeperiod=14)
        elif USING_PANDAS_TA:
            df['ATR_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
        else:
            df['ATR_14'] = VolatilityIndicators.atr(df['high'], df['low'], df['close'], 14)
        
        # Bollinger Bands
        if USING_TALIB:
            upper, middle, lower = ta.BBANDS(df['close'], timeperiod=20, nbdevup=2, nbdevdn=2)
            df['BBU_20_2.0_2.0'] = upper
            df['BBM_20_2.0_2.0'] = middle
            df['BBL_20_2.0_2.0'] = lower
        elif USING_PANDAS_TA:
            bb = ta.bbands(df['close'], length=20, std=2)
            if bb is not None:
                df = pd.concat([df, bb], axis=1)
        else:
            upper, middle, lower = VolatilityIndicators.bollinger_bands(df['close'])
            df['BBU_20_2.0_2.0'] = upper
            df['BBM_20_2.0_2.0'] = middle
            df['BBL_20_2.0_2.0'] = lower
        
        # --- KONKORDE ---
        if 'volume' in df.columns and len(df) > 1:
            koncorde = AdvancedIndicators.calculate_koncorde(
                df['close'], df['high'], df['low'], df['volume'], 15
            )
            
            df['PVI'] = koncorde['pvi']
            df['NVI'] = koncorde['nvi']
            df['PVIM'] = koncorde['pvim']
            df['NVIM'] = koncorde['nvim']
            df['KONKORDE_AZUL'] = koncorde['azul']
            df['KONKORDE_VERDE'] = koncorde['verde']
            df['KONKORDE_MARRON'] = koncorde['marron']
        
        # --- VOLUME ---
        if 'volume' in df.columns:
            if USING_TALIB:
                df['OBV'] = ta.OBV(df['close'], df['volume'])
                if 'OBV' in df.columns:
                    df['OBV_EMA'] = ta.EMA(df['OBV'], timeperiod=10)
            elif USING_PANDAS_TA:
                df['OBV'] = ta.obv(df['close'], df['volume'])
                if 'OBV' in df.columns:
                    df['OBV_EMA'] = ta.ema(df['OBV'], length=10)
            else:
                df['OBV'] = VolumeIndicators.obv(df['close'], df['volume'])
                df['OBV_EMA'] = VolumeIndicators.obv(df['close'], df['volume']).ewm(span=10, adjust=False).mean()
            
            df['VWAP'] = VolumeIndicators.vwap(df['high'], df['low'], df['close'], df['volume'])
        
        # --- ADX, Stoch ---
        if USING_TALIB:
            adx = ta.ADX(df['high'], df['low'], df['close'], timeperiod=14)
            plus_di = ta.PLUS_DI(df['high'], df['low'], df['close'], timeperiod=14)
            minus_di = ta.MINUS_DI(df['high'], df['low'], df['close'], timeperiod=14)
            df['ADX_14'] = adx
            df['DMP_14'] = plus_di
            df['DMN_14'] = minus_di
            
            slowk, slowd = ta.STOCH(df['high'], df['low'], df['close'], fastk_period=14, slowk_period=3, slowk_matype=0, slowd_period=3, slowd_matype=0)
            df['STOCH_K_14_3_3'] = slowk
            df['STOCH_D_14_3_3'] = slowd
        elif USING_PANDAS_TA:
            adx_res = ta.adx(df['high'], df['low'], df['close'], length=14)
            if adx_res is not None:
                df = pd.concat([df, adx_res], axis=1)
            
            stoch_res = ta.stoch(df['high'], df['low'], df['close'], k=14, d=3, smooth_k=3)
            if stoch_res is not None:
                df = pd.concat([df, stoch_res], axis=1)
        else:
            adx, plus_di, minus_di = TrendIndicators.adx(df['high'], df['low'], df['close'], 14)
            df['ADX_14'] = adx
            df['DMP_14'] = plus_di
            df['DMN_14'] = minus_di
            
            stoch_k, stoch_d = MomentumIndicators.stochastic(df['high'], df['low'], df['close'], 14, 3)
            df['STOCH_K_14_3_3'] = stoch_k
            df['STOCH_D_14_3_3'] = stoch_d
        
        # UO
        if USING_TALIB:
            uo_res = ta.ULTOSC(df['high'], df['low'], df['close'], timeperiod1=7, timeperiod2=14, timeperiod3=28)
            if uo_res is not None:
                df['UO'] = uo_res
        elif USING_PANDAS_TA:
            uo_res = ta.uo(df['high'], df['low'], df['close'], fast=7, medium=14, slow=28)
            if uo_res is not None:
                df['UO'] = uo_res
        else:
            df['UO'] = MomentumIndicators.uo(df['high'], df['low'], df['close'], 7, 14, 28)
        
        # PSAR
        try:
            if ta is not None and hasattr(ta, 'psar'):
                psar_res = ta.psar(df['high'], df['low'], df['close'], af0=0.02, af=0.02, max_af=0.2)
                if psar_res is not None:
                    df = pd.concat([df, psar_res], axis=1)
                    psar_cols_l = [c for c in psar_res.columns if 'PSARl' in c]
                    psar_cols_s = [c for c in psar_res.columns if 'PSARs' in c]
                    if len(psar_cols_l) > 0 and len(psar_cols_s) > 0:
                        df['PSAR'] = df[psar_cols_l[0]].fillna(df[psar_cols_s[0]])
                    elif len(psar_cols_l) > 0:
                        df['PSAR'] = df[psar_cols_l[0]]
                    elif len(psar_cols_s) > 0:
                        df['PSAR'] = df[psar_cols_s[0]]
            else:
                psar, direction = TrendIndicators.psar(df['high'], df['low'], df['close'])
                df['PSAR'] = psar
                df['PSAR_DIR'] = direction
        except Exception:
            pass
        
        return df


# ============================================================================
# EXPORTS (Hem eski hem yeni kullanım için)
# ============================================================================

__all__ = [
    # Backward compatibility
    'StrategyIndicators',
    
    # New modular imports
    'TrendIndicators',
    'MomentumIndicators',
    'VolatilityIndicators',
    'VolumeIndicators',
    'AdvancedIndicators',
    
    # Library detection
    'USING_TALIB',
    'USING_PANDAS_TA',
    'ta',
]
