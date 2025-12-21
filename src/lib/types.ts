export type BotStatus = "Çalışıyor" | "Durduruldu" | "Hata";

export type Bot = {
    id: number;
    name: string;
    pair: string;
    status: BotStatus;
    pnl: number;
    duration: string;
};

export type Log = {
    type: 'info' | 'trade' | 'warning' | 'error';
    message: string;
};
