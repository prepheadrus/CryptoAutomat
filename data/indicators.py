import pandas as pd
import numpy as np

# pandas-ta yerine manuel hesaplama veya ta-lib
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

class StrategyIndicators:
    """Verilen OHLCV DataFrame'i üzerine stratejinin ihtiyaç duyacağı tüm teknik göstergeleri işler."""

    @staticmethod
    def ema(series, length):
        """Exponential Moving Average - Manuel hesaplama"""
        return series.ewm(span=length, adjust=False).mean()

    @staticmethod
    def sma(series, length):
        """Simple Moving Average - Manuel hesaplama"""
        return series.rolling(window=length).mean()

    @staticmethod
    def rsi(series, length=14):
        """RSI - Manuel hesaplama"""
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=length).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=length).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def atr(high, low, close, length=14):
        """ATR - Manuel hesaplama"""
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.ewm(span=length, adjust=False).mean()

    @staticmethod
    def macd(series, fast=12, slow=26, signal=9):
        """MACD - Manuel hesaplama"""
        ema_fast = series.ewm(span=fast, adjust=False).mean()
        ema_slow = series.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        hist = macd_line - signal_line
        return macd_line, signal_line, hist

    @staticmethod
    def bollinger_bands(series, length=20, std=2):
        """Bollinger Bands - Manuel hesaplama"""
        sma = series.rolling(window=length).mean()
        std_dev = series.rolling(window=length).std()
        upper = sma + (std_dev * std)
        lower = sma - (std_dev * std)
        return upper, sma, lower

    @staticmethod
    def vwap(high, low, close, volume):
        """VWAP - Manuel hesaplama"""
        typical_price = (high + low + close) / 3
        return (typical_price * volume).cumsum() / volume.cumsum()

    @staticmethod
    def mfi(high, low, close, volume, period=14):
        """Money Flow Index - Manuel hesaplama"""
        typical_price = (high + low + close) / 3
        money_flow = typical_price * volume

        # Positive/Negative Money Flow
        tpp = typical_price.diff()
        pmf = pd.Series(0.0, index=close.index)
        nmf = pd.Series(0.0, index=close.index)

        pmf[tpp > 0] = money_flow[tpp > 0]
        nmf[tpp < 0] = money_flow[tpp < 0]

        # Money Ratio
        mr = pmf.rolling(window=period).sum() / nmf.rolling(window=period).sum()

        # MFI
        return 100 - (100 / (1 + mr))

    @staticmethod
    def uo(high, low, close, fast=7, medium=14, slow=28):
        """Ultimate Oscillator - Manuel hesaplama"""
        # Buying pressure ve true range
        bp = close - pd.concat([low, close.shift(1)], axis=1).min(axis=1)
        tr = pd.concat([high - low, abs(high - close.shift(1)), abs(low - close.shift(1))], axis=1).max(axis=1)

        # Averages
        avg_fast = bp.rolling(window=fast).sum() / tr.rolling(window=fast).sum()
        avg_medium = bp.rolling(window=medium).sum() / tr.rolling(window=medium).sum()
        avg_slow = bp.rolling(window=slow).sum() / tr.rolling(window=slow).sum()

        # Ultimate Oscillator
        return 100 * (4 * avg_fast + 2 * avg_medium + avg_slow) / (4 + 2 + 1)

    @staticmethod
    def psar(high, low, close=None, af0=0.02, af=0.02, max_af=0.2):
        """Parabolic SAR - Manuel hesaplama (basitleştirilmiş)"""
        if close is None:
            close = (high + low) / 2

        psar = pd.Series(index=close.index)
        trend = pd.Series(1, index=close.index)  # 1 = up, -1 = down
        ep = pd.Series(0.0, index=close.index)  # Extreme point
        accel = pd.Series(af0, index=close.index)

        # İlk değerler
        psar.iloc[0] = low.iloc[0]
        ep.iloc[0] = high.iloc[0]

        for i in range(1, len(close)):
            psar.iloc[i] = psar.iloc[i-1] + accel.iloc[i-1] * (ep.iloc[i-1] - psar.iloc[i-1])

            if trend.iloc[i-1] == 1:  # Uptrend
                if low.iloc[i] > psar.iloc[i]:
                    trend.iloc[i] = 1
                    if high.iloc[i] > ep.iloc[i-1]:
                        ep.iloc[i] = high.iloc[i]
                        accel.iloc[i] = min(accel.iloc[i-1] + af, max_af)
                    else:
                        ep.iloc[i] = ep.iloc[i-1]
                        accel.iloc[i] = accel.iloc[i-1]
                else:
                    trend.iloc[i] = -1
                    psar.iloc[i] = ep.iloc[i-1]
                    ep.iloc[i] = low.iloc[i]
                    accel.iloc[i] = af0
            else:  # Downtrend
                if high.iloc[i] < psar.iloc[i]:
                    trend.iloc[i] = -1
                    if low.iloc[i] < ep.iloc[i-1]:
                        ep.iloc[i] = low.iloc[i]
                        accel.iloc[i] = min(accel.iloc[i-1] + af, max_af)
                    else:
                        ep.iloc[i] = ep.iloc[i-1]
                        accel.iloc[i] = accel.iloc[i-1]
                else:
                    trend.iloc[i] = 1
                    psar.iloc[i] = ep.iloc[i-1]
                    ep.iloc[i] = high.iloc[i]
                    accel.iloc[i] = af0

        return psar, trend

    @staticmethod
    def supertrend(high, low, close, multiplier=3.0, period=10):
        """SuperTrend - Manuel hesaplama"""
        # ATR hesapla
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.ewm(span=period, adjust=False).mean()

        # Temel bantlar
        hl2 = (high + low) / 2
        upper_band = hl2 + multiplier * atr
        lower_band = hl2 - multiplier * atr

        # SuperTrend yönü
        supertrend = pd.Series(index=close.index)
        direction = pd.Series(1, index=close.index)  # 1 = yukarı, -1 = aşağı

        for i in range(1, len(close)):
            if close.iloc[i] > supertrend.iloc[i-1] if i > 0 and pd.notna(supertrend.iloc[i-1]) else True:
                direction.iloc[i] = 1
                supertrend.iloc[i] = lower_band.iloc[i]
            elif close.iloc[i] < supertrend.iloc[i-1] if i > 0 and pd.notna(supertrend.iloc[i-1]) else False:
                direction.iloc[i] = -1
                supertrend.iloc[i] = upper_band.iloc[i]
            else:
                direction.iloc[i] = direction.iloc[i-1] if i > 0 else 1
                if direction.iloc[i] == 1:
                    supertrend.iloc[i] = max(lower_band.iloc[i], supertrend.iloc[i-1] if i > 0 and pd.notna(supertrend.iloc[i-1]) else lower_band.iloc[i])
                else:
                    supertrend.iloc[i] = min(upper_band.iloc[i], supertrend.iloc[i-1] if i > 0 and pd.notna(supertrend.iloc[i-1]) else upper_band.iloc[i])

        return supertrend, direction
    
    @staticmethod
    def resample_data(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
        """
        1 dakikalık verileri istenen her türlü zaman dilimine (3m, 5m, 15m, 1h, 1d vb.) dönüştürür.
        GMT+3 (Türkiye) saatiyle 03:00 günlük kapanışı (UTC 00:00) ile tam uyumludur.
        """
        if df.empty or timeframe == "1m":
            return df

        # Zaman damgasını index yap (Resample için şart)
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
        
        # Pandas resample formatına çevir (Örn: 1h -> 1h, 1d -> 1D, 5m -> 5min)
        rule = timeframe.replace('m', 'min').replace('h', 'h').replace('d', 'D')
        
        # Yeniden örnekle
        resampled_df = df.resample(rule, label='left', closed='left').apply(logic)
        
        # Eksik mumları doldur (Hacim 0, diğerleri son fiyat)
        resampled_df['volume'] = resampled_df['volume'].fillna(0)
        resampled_df.ffill(inplace=True)
        
        # Index'i tekrar sütuna al ve temizle
        resampled_df.reset_index(inplace=True)
        return resampled_df

    @staticmethod
    def add_all_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Genişletilmiş Konfluans ve Momentum göstergelerini dataFrame'e ekler."""
        if df.empty or len(df) < 5:
            return df
            
        # Veri kalitesini garanti altına alalım
        for col in ['open', 'high', 'low', 'close', 'volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
        
        # VWAP gibi zamana/seansa dayalı indikatörler için mutlaka DatetimeIndex şarttır.
        if 'timestamp' in df.columns:
            if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True, drop=False)
        
        # Gürültüyü engellemek adına geçmişten gelen eksik dataları temizle
        df.ffill(inplace=True)
        df.bfill(inplace=True)
        
        if df['close'].isnull().any():
             # Hala null varsa (çok az veri), botun çökmemesi için 0 ile doldur
             df.fillna(0, inplace=True)

        # --- TREND (Eğilim) ---
        # Manuel hesaplama veya TA-Lib/pandas_ta kullan
        if USING_TALIB:
            # TA-Lib kullan (büyük harf fonksiyonlar)
            df['EMA_5'] = ta.EMA(df['close'], timeperiod=5)
            df['EMA_13'] = ta.EMA(df['close'], timeperiod=13)
            df['SMA_20'] = ta.SMA(df['close'], timeperiod=20)
            df['EMA_50'] = ta.EMA(df['close'], timeperiod=50)
            df['EMA_200'] = ta.EMA(df['close'], timeperiod=200)
        elif USING_PANDAS_TA:
            # pandas_ta kullan (küçük harf fonksiyonlar)
            df['EMA_5'] = ta.ema(df['close'], length=5)
            df['EMA_13'] = ta.ema(df['close'], length=13)
            df['SMA_20'] = ta.sma(df['close'], length=20)
            df['EMA_50'] = ta.ema(df['close'], length=50)
            df['EMA_200'] = ta.ema(df['close'], length=200)
        else:
            # Manuel hesaplama
            df['EMA_5'] = StrategyIndicators.ema(df['close'], 5)
            df['EMA_13'] = StrategyIndicators.ema(df['close'], 13)
            df['SMA_20'] = StrategyIndicators.sma(df['close'], 20)
            df['EMA_50'] = StrategyIndicators.ema(df['close'], 50)
            df['EMA_200'] = StrategyIndicators.ema(df['close'], 200)
        
        # 1. Kalman Filtresi (Gürültü Temizleyici)
        # PineScript: kalman(src, period, alpha, beta)
        def apply_kalman(src, alpha=0.015, beta=0.12, period=65):
            v1, v2 = src.iloc[0], 1.0
            v3 = alpha * period
            res = []
            for val in src:
                v4 = v2 / (v2 + v3)
                v1 = v1 + v4 * (val - v1)
                v2 = (1 - v4) * v2 + beta / period
                res.append(v1)
            return pd.Series(res, index=src.index)
        
        df['KALMAN'] = apply_kalman(df['close'])

        # Supertrend (Piyasa yönü ve dinamik destek/direnç için)
        # Not: TA-Lib'de SUPERTREND fonksiyonu yok, manuel hesaplama veya pandas_ta kullan
        if USING_PANDAS_TA:
            st = ta.supertrend(df['high'], df['low'], df['close'], length=10, multiplier=3.0)
            if st is not None:
                df = pd.concat([df, st], axis=1)
        else:
            # Manuel Supertrend hesaplama
            st, direction = StrategyIndicators.supertrend(df['high'], df['low'], df['close'], 3.0, 10)
            df['SUPERTREND'] = st
            df['SUPERTREND_DIR'] = direction

        # 2. Elliott Wave Oscillator (EWO)
        try:
            if USING_TALIB:
                sma5 = ta.SMA(df['close'], timeperiod=5)
                sma35 = ta.SMA(df['close'], timeperiod=35)
            elif USING_PANDAS_TA:
                sma5 = ta.sma(df['close'], length=5)
                sma35 = ta.sma(df['close'], length=35)
            else:
                sma5 = StrategyIndicators.sma(df['close'], 5)
                sma35 = StrategyIndicators.sma(df['close'], 35)

            if isinstance(sma5, pd.Series) and isinstance(sma35, pd.Series):
                df['EWO'] = (sma5 - sma35) / df['close'] * 100
            else:
                df['EWO'] = 0.0
        except Exception:
            df['EWO'] = 0.0

        # --- MOMENTUM (Hız/İvme) ---
        if USING_TALIB:
            df['RSI_14'] = ta.RSI(df['close'], timeperiod=14)
        elif USING_PANDAS_TA:
            df['RSI_14'] = ta.rsi(df['close'], length=14)
        else:
            df['RSI_14'] = StrategyIndicators.rsi(df['close'], 14)

        # --- BTC VIX (Volatilite Endeksi) ---
        # PineScript: ta.stdev(math.log(close/close[1]), 20) * math.sqrt(365) * 100
        log_ret = np.log(df['close'] / df['close'].shift(1))
        df['BTC_VIX'] = log_ret.rolling(20).std() * np.sqrt(365) * 100

        # MACD (Trend dönüş noktaları için)
        if USING_TALIB:
            macd = ta.MACD(df['close'], fastperiod=12, slowperiod=26, signalperiod=9)
            if macd is not None:
                df = pd.concat([df, macd], axis=1)
        elif USING_PANDAS_TA:
            macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
            if macd is not None:
                df = pd.concat([df, macd], axis=1)
        else:
            macd_line, signal_line, hist = StrategyIndicators.macd(df['close'])
            df['MACD_12_26_9'] = macd_line
            df['MACDs_12_26_9'] = signal_line
            df['MACDh_12_26_9'] = hist

        # --- VOLATİLİTE (Oynaklık ve Risk Ayarlama) ---
        if USING_TALIB:
            df['ATR_14'] = ta.ATR(df['high'], df['low'], df['close'], timeperiod=14)
        elif USING_PANDAS_TA:
            df['ATR_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
        else:
            df['ATR_14'] = StrategyIndicators.atr(df['high'], df['low'], df['close'], 14)

        # Bollinger Bantları
        if 'close' in df.columns:
            if USING_TALIB:
                bb = ta.BBANDS(df['close'], timeperiod=20, nbdevup=2, nbdevdn=2)
                if bb is not None:
                    df = pd.concat([df, bb], axis=1)
            elif USING_PANDAS_TA:
                bb = ta.bbands(df['close'], length=20, std=2)
                if bb is not None:
                    df = pd.concat([df, bb], axis=1)
            else:
                upper, middle, lower = StrategyIndicators.bollinger_bands(df['close'])
                df['BBU_20_2.0_2.0'] = upper
                df['BBM_20_2.0_2.0'] = middle
                df['BBL_20_2.0_2.0'] = lower

        # --- KONKORDE (AKILLI PARA İZLEME - PVI & NVI) ---
        if 'volume' in df.columns and len(df) > 1:
            close_arr = df['close'].values
            vol_arr = df['volume'].values
            
            # PVI (Positive Volume Index)
            pvi = np.zeros(len(df))
            pvi[0] = 100.0
            for i in range(1, len(df)):
                if vol_arr[i] > vol_arr[i-1]:
                    ret = (close_arr[i] - close_arr[i-1]) / (close_arr[i-1] if close_arr[i-1] != 0 else 1.0)
                    pvi[i] = pvi[i-1] + (ret * vol_arr[i])
                else:
                    pvi[i] = pvi[i-1]
            df['PVI'] = pvi
            
            # NVI (Negative Volume Index)
            nvi = np.zeros(len(df))
            nvi[0] = 100.0
            for i in range(1, len(df)):
                if vol_arr[i] < vol_arr[i-1]:
                    ret = (close_arr[i] - close_arr[i-1]) / (close_arr[i-1] if close_arr[i-1] != 0 else 1.0)
                    nvi[i] = nvi[i-1] + (ret * vol_arr[i])
                else:
                    nvi[i] = nvi[i-1]
            df['NVI'] = nvi
            
            # Koncorde Bileşenleri
            try:
                if USING_TALIB:
                    pvim = ta.EMA(df['PVI'], timeperiod=15)
                    nvim = ta.EMA(df['NVI'], timeperiod=15)
                    xrsi = ta.RSI(df['close'], timeperiod=14)
                    mfi = ta.MFI(df['high'], df['low'], df['close'], df['volume'], timeperiod=14)
                elif USING_PANDAS_TA:
                    pvim = ta.ema(df['PVI'], length=15)
                    nvim = ta.ema(df['NVI'], length=15)
                    xrsi = ta.rsi(df['close'], length=14)
                    mfi = ta.mfi(df['high'], df['low'], df['close'], df['volume'], length=14)
                else:
                    # Manuel hesaplama
                    pvim = StrategyIndicators.ema(df['PVI'], 15)
                    nvim = StrategyIndicators.ema(df['NVI'], 15)
                    xrsi = StrategyIndicators.rsi(df['close'], 14)
                    # MFI manuel hesaplama (basitleştirilmiş)
                    mfi = StrategyIndicators.mfi(df['high'], df['low'], df['close'], df['volume'], 14)

                df['PVIM'] = pvim if pvim is not None else df['PVI']
                df['NVIM'] = nvim if nvim is not None else df['NVI']

                # Azul (Smart Money - Mavi Alan)
                nvim_max = df['NVIM'].rolling(90, min_periods=1).max()
                nvim_min = df['NVIM'].rolling(90, min_periods=1).min()
                df['KONKORDE_AZUL'] = (df['NVI'] - df['NVIM']) * 100 / (nvim_max - nvim_min).replace(0, 1)

                # Verde (Retail - Yeşil Alan)
                pvim_max = df['PVIM'].rolling(90, min_periods=1).max()
                pvim_min = df['PVIM'].rolling(90, min_periods=1).min()
                oscp = (df['PVI'] - df['PVIM']) * 100 / (pvim_max - pvim_min).replace(0, 1)

                # Marron (Trend Ortalama)
                if isinstance(xrsi, pd.Series) and isinstance(mfi, pd.Series):
                    df['KONKORDE_MARRON'] = (xrsi + mfi) / 2 # Simüle edilmiş basitleştirilmiş trend
                    df['KONKORDE_VERDE'] = df['KONKORDE_MARRON'] + oscp
                else:
                    df['KONKORDE_MARRON'] = 0.0
                    df['KONKORDE_VERDE'] = 0.0
            except Exception as e:
                df['KONKORDE_AZUL'] = 0.0
                df['KONKORDE_VERDE'] = 0.0
                df['KONKORDE_MARRON'] = 0.0

        # --- HACİM VE LİKİDİTE ---
        if 'volume' in df.columns:
            if USING_TALIB:
                df['OBV'] = ta.OBV(df['close'], df['volume'])
                if 'OBV' in df.columns:
                    df['OBV_EMA'] = ta.EMA(df['OBV'], timeperiod=10)
                try:
                    df['VWAP'] = ta.VWAP(df['high'], df['low'], df['close'], df['volume'])
                except Exception:
                    pass
            elif USING_PANDAS_TA:
                df['OBV'] = ta.obv(df['close'], df['volume'])
                if 'OBV' in df.columns:
                    df['OBV_EMA'] = ta.ema(df['OBV'], length=10)
                try:
                    df['VWAP'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'], anchor="D")
                except Exception:
                    pass
            else:
                # Manuel OBV hesaplama
                df['OBV'] = (np.sign(df['close'].diff()) * df['volume']).fillna(0).cumsum()
                df['OBV_EMA'] = StrategyIndicators.ema(df['OBV'], 10)
                # Manuel VWAP
                df['VWAP'] = StrategyIndicators.vwap(df['high'], df['low'], df['close'], df['volume'])

        # --- YENİ EKLENEN ŞABLON İNDİKATÖRLERİ (ADX, Stoch) ---
        # 1. ADX (Trend Gücü)
        if USING_TALIB:
            adx_res = ta.ADX(df['high'], df['low'], df['close'], timeperiod=14)
            if adx_res is not None:
                df = pd.concat([df, adx_res], axis=1)
        elif USING_PANDAS_TA:
            adx_res = ta.adx(df['high'], df['low'], df['close'], length=14)
            if adx_res is not None:
                df = pd.concat([df, adx_res], axis=1)
        else:
            # Manuel ADX hesaplama
            plus_dm = df['high'].diff()
            minus_dm = -df['low'].diff()
            plus_dm = np.where((plus_dm > minus_dm) & (plus_dm > 0), plus_dm, 0)
            minus_dm = np.where((minus_dm > plus_dm) & (minus_dm > 0), minus_dm, 0)

            tr = np.maximum(df['high'] - df['low'],
                           np.maximum(abs(df['high'] - df['close'].shift(1)),
                                     abs(df['low'] - df['close'].shift(1))))

            tr_smooth = pd.Series(tr).rolling(14).sum()
            plus_di = 100 * pd.Series(plus_dm).rolling(14).sum() / tr_smooth
            minus_di = 100 * pd.Series(minus_dm).rolling(14).sum() / tr_smooth

            dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
            df['ADX_14'] = dx.rolling(14).mean()
            df['DMP_14'] = plus_di
            df['DMN_14'] = minus_di

        # 2. Stochastic Osilatör
        if USING_TALIB:
            stoch_res = ta.STOCH(df['high'], df['low'], df['close'], fastk_period=14, slowk_period=3, slowk_matype=0, slowd_period=3, slowd_matype=0)
            if stoch_res is not None:
                df = pd.concat([df, stoch_res], axis=1)
        elif USING_PANDAS_TA:
            stoch_res = ta.stoch(df['high'], df['low'], df['close'], k=14, d=3, smooth_k=3)
            if stoch_res is not None:
                df = pd.concat([df, stoch_res], axis=1)
        else:
            lowest_low = df['low'].rolling(14).min()
            highest_high = df['high'].rolling(14).max()
            stoch_k = 100 * (df['close'] - lowest_low) / (highest_high - lowest_low)
            stoch_d = stoch_k.rolling(3).mean()
            df['STOCH_K_14_3_3'] = stoch_k
            df['STOCH_D_14_3_3'] = stoch_d

        # 3. Ultimate Oscillator (UO)
        if USING_TALIB:
            uo_res = ta.ULTOSC(df['high'], df['low'], df['close'], timeperiod1=7, timeperiod2=14, timeperiod3=28)
            if uo_res is not None:
                df['UO'] = uo_res
        elif USING_PANDAS_TA:
            uo_res = ta.uo(df['high'], df['low'], df['close'], fast=7, medium=14, slow=28)
            if uo_res is not None:
                df['UO'] = uo_res
        else:
            # Manuel UO hesaplama
            df['UO'] = StrategyIndicators.uo(df['high'], df['low'], df['close'], 7, 14, 28)

        # 4. Parabolic SAR (PSAR) - Manuel hesaplama
        try:
            if ta is not None:
                psar_res = ta.psar(df['high'], df['low'], df['close'], af0=0.02, af=0.02, max_af=0.2)
                if psar_res is not None:
                    df = pd.concat([df, psar_res], axis=1)

                    psar_cols_l = [c for c in psar_res.columns if 'PSARl' in c]
                    psar_cols_s = [c for c in psar_res.columns if 'PSARs' in c]

                    # PSAR konsolide değeri
                    if len(psar_cols_l) > 0 and len(psar_cols_s) > 0:
                        df['PSAR'] = df[psar_cols_l[0]].fillna(df[psar_cols_s[0]])
                    elif len(psar_cols_l) > 0:
                        df['PSAR'] = df[psar_cols_l[0]]
                    elif len(psar_cols_s) > 0:
                        df['PSAR'] = df[psar_cols_s[0]]
            else:
                # Manuel PSAR hesaplama
                psar, direction = StrategyIndicators.psar(df['high'], df['low'], df['close'])
                df['PSAR'] = psar
                df['PSAR_DIR'] = direction
        except Exception:
            pass
            
        # 5. Demand Index (Talep Endeksi) - Modifiye Edilmiş Hacim/Fiyat Baskı Modeli
        try:
            if 'volume' in df.columns:
                # Verileri float tipine zorla ve NaN'ları temizle
                close_arr = df['close'].astype(float)
                vol_arr = df['volume'].astype(float)
                
                close_change = close_arr.diff()
                
                bp = np.where(close_change > 0, vol_arr * close_change, 0)
                sp = np.where(close_change < 0, vol_arr * close_change.abs(), 0)
                
                bp_ema = pd.Series(bp, index=df.index).ewm(span=14, adjust=False).mean()
                sp_ema = pd.Series(sp, index=df.index).ewm(span=14, adjust=False).mean()
                
                # -100 ile +100 arasında salınan bir osilatör üretir
                # Sıfıra bölünme hatasını replace(0, 1) ile önlüyoruz
                di = np.where(bp_ema > sp_ema,
                              (bp_ema - sp_ema) / bp_ema.replace(0, 1) * 100,
                              (bp_ema - sp_ema) / sp_ema.replace(0, 1) * -100) 
                df['DEMAND_INDEX'] = di
                df['DEMAND_INDEX'] = df['DEMAND_INDEX'].fillna(0)
        except Exception as e:
            logger.error(f"Demand Index error: {e}")

        # --- YENİ EKLENEN ŞABLON ÖZELLİKLERİ (SENKRONİZE UYUŞMAZLIK AVCISI İÇİN) ---
        try:
            # Uyuşmazlık Tespiti için Geriye Dönük (10 mum) Dip Arayışı
            if all(col in df.columns for col in ['close', 'DEMAND_INDEX', 'UO', 'DMP_14', 'DMN_14']):
                df['PRICE_MIN_10'] = df['low'].rolling(10).min()
                df['DEMAND_MIN_10'] = df['DEMAND_INDEX'].rolling(10).min()
                df['UO_MIN_10'] = df['UO'].rolling(10).min()
                
                # Fiyat yeni dip yapıyor ama osilatörler düşmüyorsa = Pozitif Uyuşmazlık
                df['DIV_PRICE_LOWER'] = df['low'] <= df['PRICE_MIN_10'].shift(1)
                df['DIV_DEMAND_HIGHER'] = df['DEMAND_INDEX'] > df['DEMAND_MIN_10'].shift(1)
                df['DIV_UO_HIGHER'] = df['UO'] > df['UO_MIN_10'].shift(1)
                
                # ADX Kesişimleri (+DI, -DI'yi yukarı keserse)
                df['ADX_BULL_CROSS'] = (df['DMP_14'] > df['DMN_14']) & (df['DMP_14'].shift(1) <= df['DMN_14'].shift(1))
                df['ADX_BEAR_CROSS'] = (df['DMN_14'] > df['DMP_14']) & (df['DMN_14'].shift(1) <= df['DMP_14'].shift(1))
        except Exception as e:
            logger.error(f"Divergence features error: {e}")

        # --- K-NEAREST NEIGHBORS (KNN) TAHMİN MOTORU ---
        try:
            from sklearn.neighbors import NearestNeighbors
            
            k = 15
            t_horizon = 5
            window = 500
            
            # UZAYSAL (X) DEĞİŞKENLER: Trend, Momentum, Hacim
            features = ['close', 'volume', 'RSI_14', 'DEMAND_INDEX', 'UO']
            avail_f = [f for f in features if f in df.columns]
            
            if len(avail_f) >= 3:
                # HEDEF DEĞİŞKEN (Y): T süre sonraki fiyat değişimi (Shift eksi ile geleceği alır)
                df['future_ret'] = df['close'].shift(-t_horizon) / df['close'] - 1.0
                
                # Z-SCORE veya Rolling Min-Max ile %100 Causal (Geleceği görmeden) Normalizasyon
                df_min = df[avail_f].rolling(window=window, min_periods=50).min()
                df_max = df[avail_f].rolling(window=window, min_periods=50).max()
                X_scaled = (df[avail_f] - df_min) / (df_max - df_min).replace(0, 1)
                
                X_vals = X_scaled.values
                Y_vals = df['future_ret'].values
                
                knn_preds = np.zeros(len(df))
                
                # Baştaki mumları atla, history biriksin
                for i in range(100, len(df)):
                    # Geçmiş 500 mum içinden, hedefi belli olan (i-t_horizon) kısmı kes
                    start_idx = max(0, i - window)
                    end_idx = i - t_horizon
                    
                    if end_idx - start_idx > k:
                        X_train = X_vals[start_idx:end_idx]
                        Y_train = Y_vals[start_idx:end_idx]
                        X_test = X_vals[i].reshape(1, -1)
                        
                        # Eksik veri barındıran satırları temizle
                        valid_mask = ~np.isnan(X_train).any(axis=1) & ~np.isnan(Y_train)
                        X_train = X_train[valid_mask]
                        Y_train = Y_train[valid_mask]
                        
                        if len(X_train) >= k and not np.isnan(X_test).any():
                            nbrs = NearestNeighbors(n_neighbors=k, algorithm='auto').fit(X_train)
                            distances, indices = nbrs.kneighbors(X_test)
                            pred_ret = np.mean(Y_train[indices[0]])
                            knn_preds[i] = pred_ret
                            
                df['KNN_PREDICTED_RETURN'] = knn_preds
        except Exception as e:
            logger.error(f"KNN calculation error: {e}")

        # --- NİHAİ TEMİZLİK VE TİP KORUMASI ---
        # Tüm sütunları sayısal tipe (float) zorla ve kalan Boş (None/NaN) değerleri temizle
        meta_cols = ['timestamp', 'timestamp_ms', 'symbol', 'exchange']
        for col in df.columns:
            if col not in meta_cols:
                df[col] = pd.to_numeric(df[col], errors='coerce').astype(float)
        
        df.ffill(inplace=True)
        df.bfill(inplace=True)
        df.fillna(0, inplace=True)
        
        return df
