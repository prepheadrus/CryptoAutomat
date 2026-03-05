import asyncio
import pandas as pd
from train import download_and_prepare_data
import logging

async def see_missing():
    X, y = await download_and_prepare_data()
    if X is None:
        print("X is None!")
    else:
        print("Success! X shape:", X.shape)

if __name__ == '__main__':
    asyncio.run(see_missing())
