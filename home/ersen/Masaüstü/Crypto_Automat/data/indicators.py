        # EMA using talib or fallback to pandas_ta
        try:
            # Try using talib first
            df['EMA_5'] = ta.EMA(df['close'], timeperiod=5)
        except AttributeError:
            # If talib doesn't have EMA, use pandas_ta
            df['EMA_5'] = ta.ema(df['close'], length=5)
        
        try:
            df['EMA_13'] = ta.EMA(df['close'], timeperiod=13)
        except AttributeError:
            df['EMA_13'] = ta.ema(df['close'], length=13)
        
        try:
            df['EMA_21'] = ta.EMA(df['close'], timeperiod=21)
        except AttributeError:
            df['EMA_21'] = ta.ema(df['close'], length=21)
        
        try:
            df['EMA_50'] = ta.EMA(df['close'], timeperiod=50)
        except AttributeError:
            df['EMA_50'] = ta.ema(df['close'], length=50)
        
        try:
            df['EMA_200'] = ta.EMA(df['close'], timeperiod=200)
        except AttributeError:
            df['EMA_200'] = ta.ema(df['close'], length=200)