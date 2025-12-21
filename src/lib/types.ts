export type BotStatus = "Çalışıyor" | "Durduruldu" | "Hata";

export type BotConfig = {
    mode: 'LIVE' | 'PAPER';
    stopLoss: number;
    takeProfit: number;
    trailingStop: boolean;
    amountType: 'fixed' | 'percentage';
    amount: number;
    leverage: number;
    // Paper/Live trading state
    initialBalance?: number;
    currentBalance?: number;
    inPosition?: boolean;
    entryPrice?: number;
    positionSize?: number;
};

export type Bot = {
    id: number;
    name: string;
    pair: string;
    status: BotStatus;
    pnl: number;
    duration: string;
    config: BotConfig;
};

export type Log = {
    type: 'info' | 'trade' | 'warning' | 'error';
    message: string;
};
