import crypto from 'crypto';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type NetworkType = 'mainnet' | 'spot-testnet' | 'futures-testnet';

export interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean; // Deprecated: use networkType instead
  networkType?: NetworkType;
}

export interface MarketOrder {
  symbol: string;
  side: OrderSide;
  quantity?: number;
  quoteOrderQty?: number; // For buying with USDT amount
}

export interface LimitOrder extends MarketOrder {
  price: number;
  timeInForce?: TimeInForce;
}

export interface BinanceOrderResponse {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  type: string;
  side: string;
  fills?: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInfo {
  balances: AccountBalance[];
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
}

/**
 * Binance API Client
 * Supports Mainnet, Spot Testnet, and Futures Testnet
 */
export class BinanceAPI {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private timeOffset: number = 0;
  private timeSynced: boolean = false;

  constructor(credentials: BinanceCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;

    // Determine network type (backwards compatible with testnet boolean)
    let networkType: NetworkType = credentials.networkType || 'mainnet';
    if (!credentials.networkType && credentials.testnet) {
      networkType = 'spot-testnet'; // Backwards compatibility
    }

    // Set base URL based on network type
    switch (networkType) {
      case 'spot-testnet':
        this.baseUrl = 'https://testnet.binance.vision/api';
        break;
      case 'futures-testnet':
        this.baseUrl = 'https://testnet.binancefuture.com/fapi';
        break;
      case 'mainnet':
      default:
        this.baseUrl = 'https://api.binance.com/api';
        break;
    }

    console.log(`[Binance API] Initialized with ${networkType} (${this.baseUrl})`);
  }

  /**
   * Generate HMAC SHA256 signature for authenticated requests
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Sync local time with Binance server time
   */
  private async syncServerTime(): Promise<void> {
    try {
      const serverTime = await this.getServerTime();
      const localTime = Date.now();
      this.timeOffset = serverTime - localTime;
      this.timeSynced = true;
      console.log(`[Binance API] Time synced. Offset: ${this.timeOffset}ms`);
    } catch (error) {
      console.warn('[Binance API] Failed to sync time, using local time');
      this.timeOffset = 0;
      this.timeSynced = false;
    }
  }

  /**
   * Make authenticated request to Binance API
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    params: Record<string, any> = {},
    signed: boolean = false
  ): Promise<T> {
    // Sync time with server if this is a signed request and we haven't synced yet
    if (signed && !this.timeSynced) {
      await this.syncServerTime();
    }

    const timestamp = Date.now() + this.timeOffset;
    const queryParams = new URLSearchParams({
      ...params,
      ...(signed ? { timestamp: timestamp.toString() } : {}),
    });

    let queryString = queryParams.toString();

    if (signed) {
      const signature = this.sign(queryString);
      queryString += `&signature=${signature}`;
    }

    const url = `${this.baseUrl}${endpoint}?${queryString}`;

    const headers: HeadersInit = {
      'X-MBX-APIKEY': this.apiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(`Binance API Error: ${error.msg || error.code || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test connectivity to Binance API
   */
  async ping(): Promise<boolean> {
    try {
      await this.request('GET', '/v3/ping');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<number> {
    const response = await this.request<{ serverTime: number }>('GET', '/v3/time');
    return response.serverTime;
  }

  /**
   * Test API credentials and permissions
   */
  async testCredentials(): Promise<{ valid: boolean; message: string }> {
    try {
      const accountInfo = await this.getAccountInfo();
      if (accountInfo.canTrade) {
        return { valid: true, message: 'API credentials are valid and trading is enabled.' };
      } else {
        return { valid: false, message: 'API credentials are valid but trading is disabled.' };
      }
    } catch (error: any) {
      return { valid: false, message: error.message || 'Invalid API credentials' };
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<AccountInfo> {
    return this.request<AccountInfo>('GET', '/v3/account', {}, true);
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<AccountBalance[]> {
    const account = await this.getAccountInfo();
    return account.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  }

  /**
   * Get balance for a specific asset
   */
  async getBalance(asset: string): Promise<AccountBalance | null> {
    const balances = await this.getBalances();
    return balances.find(b => b.asset === asset) || null;
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    const response = await this.request<{ price: string }>('GET', '/v3/ticker/price', { symbol });
    return parseFloat(response.price);
  }

  /**
   * Place a market order
   */
  async marketOrder(order: MarketOrder): Promise<BinanceOrderResponse> {
    const params: Record<string, any> = {
      symbol: order.symbol,
      side: order.side,
      type: 'MARKET',
    };

    if (order.quantity) {
      params.quantity = order.quantity;
    } else if (order.quoteOrderQty) {
      params.quoteOrderQty = order.quoteOrderQty;
    } else {
      throw new Error('Either quantity or quoteOrderQty must be specified');
    }

    return this.request<BinanceOrderResponse>('POST', '/v3/order', params, true);
  }

  /**
   * Place a limit order
   */
  async limitOrder(order: LimitOrder): Promise<BinanceOrderResponse> {
    if (!order.quantity) {
      throw new Error('Quantity is required for limit orders');
    }

    const params: Record<string, any> = {
      symbol: order.symbol,
      side: order.side,
      type: 'LIMIT',
      quantity: order.quantity,
      price: order.price,
      timeInForce: order.timeInForce || 'GTC',
    };

    return this.request<BinanceOrderResponse>('POST', '/v3/order', params, true);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return this.request('DELETE', '/v3/order', { symbol, orderId }, true);
  }

  /**
   * Get open orders for a symbol
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    const params = symbol ? { symbol } : {};
    return this.request<any[]>('GET', '/v3/openOrders', params, true);
  }

  /**
   * Helper: Buy with USDT amount
   */
  async buyWithUSDT(symbol: string, usdtAmount: number): Promise<BinanceOrderResponse> {
    return this.marketOrder({
      symbol,
      side: 'BUY',
      quoteOrderQty: usdtAmount,
    });
  }

  /**
   * Helper: Sell all of an asset
   */
  async sellAll(symbol: string): Promise<BinanceOrderResponse> {
    const baseAsset = symbol.replace('/USDT', '').replace('USDT', '');
    const balance = await this.getBalance(baseAsset);

    if (!balance || parseFloat(balance.free) === 0) {
      throw new Error(`No ${baseAsset} balance to sell`);
    }

    return this.marketOrder({
      symbol: symbol.replace('/', ''),
      side: 'SELL',
      quantity: parseFloat(balance.free),
    });
  }
}

/**
 * Create a Binance API client from stored credentials
 */
export async function createBinanceClient(testnet: boolean = false): Promise<BinanceAPI | null> {
  if (typeof window === 'undefined') {
    // Server-side: credentials should be passed from API route
    return null;
  }

  try {
    const stored = localStorage.getItem('exchangeKeys');
    if (!stored) return null;

    const keys = JSON.parse(stored);
    const credentials = testnet ? keys.binanceTestnet : keys.binance;

    if (!credentials?.apiKey || !credentials?.apiSecret) {
      return null;
    }

    return new BinanceAPI({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      testnet,
    });
  } catch (error) {
    console.error('Error creating Binance client:', error);
    return null;
  }
}
