import ccxt, { Exchange } from 'ccxt';

// This is a server-side module. Do not import in client components.

/**
 * Returns a list of all supported exchanges.
 * @returns An array of exchange IDs.
 */
export async function getSupportedExchanges() {
    return ccxt.exchanges;
}

/**
 * Fetches the current ticker information (including price) for a given exchange and symbol.
 * @param exchange A CCXT exchange instance.
 * @param symbol The trading pair (e.g., 'BTC/USDT').
 * @returns A ticker object.
 */
export async function getTicker(exchange: Exchange, symbol: string) {
    try {
        const ticker = await exchange.fetchTicker(symbol);
        return ticker;
    } catch (error) {
        console.error(`Error fetching ticker from ${exchange.id} for ${symbol}:`, error);
        throw new Error(`Could not fetch ticker data. See server logs for details.`);
    }
}

/**
 * Fetches the current price for a given exchange and symbol.
 * @param exchange A CCXT exchange instance.
 * @param symbol The trading pair (e.g., 'BTC/USDT').
 * @returns The last price of the symbol.
 */
export async function fetchPrice(exchange: Exchange, symbol: string): Promise<number> {
    const ticker = await getTicker(exchange, symbol);
    if (!ticker || typeof ticker.last !== 'number') {
        throw new Error(`Could not fetch a valid price from ${exchange.id} for ${symbol}.`);
    }
    return ticker.last;
}


/**
 * Fetches candle (OHLCV) data for a given exchange and symbol.
 * @param exchange A CCXT exchange instance.
 * @param symbol The trading pair (e.g., 'BTC/USDT').
 * @param timeframe The time interval (e.g., '1h', '4h', '1d').
 * @param limit The number of candles to fetch.
 * @returns An array of candle data.
 */
export async function fetchOHLCV(exchange: Exchange, symbol: string, timeframe: string = '1h', limit: number = 100): Promise<ccxt.OHLCV[]> {
     if (!exchange.has['fetchOHLCV']) {
        throw new Error(`The '${exchange.id}' exchange does not support fetchOHLCV.`);
    }

    try {
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return ohlcv;
    } catch (error) {
        console.error(`Error fetching OHLCV from ${exchange.id} for ${symbol}:`, error);
        throw new Error(`Could not fetch OHLCV data. See server logs for details.`);
    }
}

/**
 * Validates API keys by attempting to fetch the account balance.
 * @param exchangeId The exchange ID (e.g., 'binance').
 * @param apiKey The user's API key.
 * @param secret The user's secret key.
 * @returns A promise that resolves if keys are valid, and rejects otherwise.
 */
export async function validateApiKeys(exchangeId: string, apiKey: string, secret: string): Promise<boolean> {
    if (!ccxt.exchanges.includes(exchangeId)) {
        throw new Error(`'${exchangeId}' is not a supported exchange.`);
    }
    
    try {
        const exchangeClass = (ccxt as any)[exchangeId];
        const exchange = new exchangeClass({
            apiKey,
            secret,
            options: {
                defaultType: 'future', // Or 'spot' depending on what you want to test
            },
        });
        
        // Fetching balance is a common way to test private API endpoint access.
        await exchange.fetchBalance();
        return true;
    } catch (error: any) {
        // Re-throw specific, more user-friendly errors
        if (error instanceof ccxt.AuthenticationError) {
            throw new Error('Kimlik doğrulama başarısız. Lütfen API anahtarınızı ve gizli anahtarınızı kontrol edin.');
        }
        if (error instanceof ccxt.InvalidNonce) {
            throw new Error('Geçersiz Nonce. Lütfen API anahtarlarınızı yeniden oluşturun ve tekrar deneyin.');
        }
        if (error instanceof ccxt.NetworkError) {
             throw new Error('Ağ Hatası. Borsa API\'sine ulaşılamıyor. İnternet bağlantınızı kontrol edin.');
        }
        console.error(`API Key validation failed for ${exchangeId}:`, error);
        throw new Error('API anahtarları doğrulanamadı. Ayrıntılar için sunucu günlüklerine bakın.');
    }
}
