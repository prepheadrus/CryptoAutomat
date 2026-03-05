import asyncio
import pandas as pd
import numpy as np
import pickle
import os
from core.exchange import ExchangeManager
from data.indicators import StrategyIndicators
from data.features import AdvancedFeatures

async def test_analysis():
    exchange = ExchangeManager()
    symbol = "BTC/USDT"
    limit = 200
    
    ohlcv = await exchange.fetch_ohlcv(symbol, limit=limit)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df = StrategyIndicators.add_all_indicators(df)
    df['volatility_ema'] = AdvancedFeatures.get_volatility(df['close'], span=20)
    df.fillna(0, inplace=True)
    
    print("Columns in DF:", df.columns.tolist())
    
    feature_cols = [
        'open', 'high', 'low', 'close', 'volume', 
        'SMA_20', 'EMA_50', 'RSI_14', 
        'MACD_12_26_9', 'MACDs_12_26_9', 'MACDh_12_26_9',
        'ATR_14', 'BBU_20_2.0_2.0', 'BBL_20_2.0_2.0', 'VWAP', 'volatility_ema'
    ]
    
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        print("MISSING COLS:", missing)
    else:
        print("All features present.")
        
    model_path = "artifacts/trained_models/xgb_model.pkl"
    if os.path.exists(model_path):
        with open(model_path, 'rb') as f:
            xgb_model = pickle.load(f)
            from xgboost import DMatrix
            try:
                X = df[feature_cols]
                dtest = DMatrix(X)
                probs = xgb_model.model.predict(dtest)
                print("Predictions sample:", probs[:5])
                f_scores = xgb_model.model.get_score(importance_type='weight')
                print("F-Scores keys:", f_scores.keys())
            except Exception as e:
                print("Error during prediction:", e)
    else:
        print("Model file not found at", model_path)

    await exchange.close()

if __name__ == "__main__":
    asyncio.run(test_analysis())
