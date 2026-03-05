from data.indicators import StrategyIndicators
from data.features import AdvancedFeatures
import pandas as pd
import numpy as np
df = pd.DataFrame({
    'timestamp': pd.date_range('2025-01-01', periods=100, freq='1h'),
    'open': np.random.rand(100),
    'high': np.random.rand(100) + 1,
    'low': np.random.rand(100),
    'close': np.random.rand(100) * 1.5,
    'volume': np.random.rand(100) * 10
})
df = StrategyIndicators.add_all_indicators(df)
print(df.columns.tolist())
