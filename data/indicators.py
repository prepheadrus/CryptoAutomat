import pandas as pd
try:
    import pandas_ta as ta
except ImportError:
    try:
        import pandas_ta_classic as ta
    except ImportError:
        ta = None # Veya boş bir nesne
import numpy as np

class StrategyIndicators:
    """Verilen OHLCV DataFrame'i üzerine stratejinin ihtiyaç duyacağı tüm teknik göstergeleri işler."""
    
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
        
        # Pandas resample formatına çevir (Örn: 1h -> 1H, 1d -> 1D)
        rule = timeframe.replace('m', 'min').replace('h', 'H').replace('d', 'D')
        
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
        df['EMA_5'] = ta.ema(df['close'], length=5)
        df['EMA_13'] = ta.ema(df['close'], length=13)
        df['SMA_20'] = ta.sma(df['close'], length=20)
        df['EMA_50'] = ta.ema(df['close'], length=50)
        df['EMA_200'] = ta.ema(df['close'], length=200)
        
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
        st = ta.supertrend(df['high'], df['low'], df['close'], length=10, multiplier=3.0)
        if st is not None:
            df = pd.concat([df, st], axis=1)

        # 2. Elliott Wave Oscillator (EWO)
        try:
            sma5 = ta.sma(df['close'], length=5)
            sma35 = ta.sma(df['close'], length=35)
            if isinstance(sma5, pd.Series) and isinstance(sma35, pd.Series):
                df['EWO'] = (sma5 - sma35) / df['close'] * 100
            else:
                df['EWO'] = 0.0
        except Exception:
            df['EWO'] = 0.0

        # --- MOMENTUM (Hız/İvme) ---
        df['RSI_14'] = ta.rsi(df['close'], length=14)
        
        # --- BTC VIX (Volatilite Endeksi) ---
        # PineScript: ta.stdev(math.log(close/close[1]), 20) * math.sqrt(365) * 100
        log_ret = np.log(df['close'] / df['close'].shift(1))
        df['BTC_VIX'] = log_ret.rolling(20).std() * np.sqrt(365) * 100

        # MACD (Trend dönüş noktaları için)
        macd = ta.macd(df['close'], fast=12, slow=26, signal=9)
        if macd is not None:
            df = pd.concat([df, macd], axis=1)

        # --- VOLATİLİTE (Oynaklık ve Risk Ayarlama) ---
        df['ATR_14'] = ta.atr(df['high'], df['low'], df['close'], length=14)
        
        # Bollinger Bantları
        if 'close' in df.columns:
            bb = ta.bbands(df['close'], length=20, std=2)
            if bb is not None:
                df = pd.concat([df, bb], axis=1)

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
                pvim = ta.ema(df['PVI'], length=15)
                df['PVIM'] = pvim if pvim is not None else df['PVI']
                
                nvim = ta.ema(df['NVI'], length=15)
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
                xrsi = ta.rsi(df['close'], length=14)
                mfi = ta.mfi(df['high'], df['low'], df['close'], df['volume'], length=14)
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
            df['OBV'] = ta.obv(df['close'], df['volume'])
            
            # OBV yönünü veya direncini test edebilmek için kendi basit EMA'sı eklendi (Sinyal çizgisi)
            if 'OBV' in df.columns:
                df['OBV_EMA'] = ta.ema(df['OBV'], length=10)

            try:
                df['VWAP'] = ta.vwap(df['high'], df['low'], df['close'], df['volume'], anchor="D")
            except Exception:
                pass

        # --- YENİ EKLENEN ŞABLON İNDİKATÖRLERİ (ADX, Stoch) ---
        # 1. ADX (Trend Gücü)
        adx_res = ta.adx(df['high'], df['low'], df['close'], length=14)
        if adx_res is not None:
            df = pd.concat([df, adx_res], axis=1)

        # 2. Stochastic Osilatör
        stoch_res = ta.stoch(df['high'], df['low'], df['close'], k=14, d=3, smooth_k=3)
        if stoch_res is not None:
            df = pd.concat([df, stoch_res], axis=1)

        # 3. Ultimate Oscillator (UO)
        try:
            uo_res = ta.uo(df['high'], df['low'], df['close'], fast=7, medium=14, slow=28)
            if uo_res is not None:
                df['UO'] = uo_res
        except Exception:
            pass

        # 4. Parabolic SAR (PSAR)
        try:
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
