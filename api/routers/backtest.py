"""
Backtest API Endpoints

FastAPI router for backtest operations.
Frontend ile Backtest Engine arasındaki köprü.

Endpoints:
- POST /api/v1/backtest/run: Backtest çalıştır
- GET /api/v1/backtest/results/{id}: Sonuçları al
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path
import json
import pandas as pd
import numpy as np

# Backtest modüllerinden import
from core.backtester import VectorizedBacktester, BacktestResult, Trade
from strategy.builder.executor import StrategyExecutor

# Bot modüllerinden import
from core.logger import logger
from data.indicators import StrategyIndicators

# Router oluştur
router = APIRouter(prefix="/api/v1/backtest", tags=["Backtest"])


# ============================================================================
# PYDANTIC MODELLERİ (Request/Response Şemaları)
# ============================================================================

class BacktestRequest(BaseModel):
    """Backtest çalıştırma isteği"""
    strategy: Dict[str, Any] = Field(..., description="Strateji JSON (name, indicators, conditions, risk)")
    strategy_filename: Optional[str] = Field(default=None, description="Kaydedilmiş strateji dosya adı")
    symbol: str = Field(..., description="Sembol (örn: BTC/USDT)")
    timeframe: str = Field(default="1h", description="Zaman dilimi (1m, 5m, 15m, 1h, 4h, 1d)")
    days: int = Field(default=30, description="Test edilecek gün sayısı", ge=1, le=365)
    initial_balance: float = Field(default=10000.0, description="Başlangıç bakiyesi ($)")
    risk_per_trade: float = Field(default=0.01, description="İşlem başına risk (%)", ge=0.001, le=0.1)


class TradeSummary(BaseModel):
    """İşlem özeti (response için)"""
    entry_time: str = Field(..., description="Giriş zamanı")
    exit_time: str = Field(..., description="Çıkış zamanı")
    entry_price: float = Field(..., description="Giriş fiyatı")
    exit_price: float = Field(..., description="Çıkış fiyatı")
    direction: str = Field(..., description="Yön (LONG/SHORT)")
    pnl: float = Field(..., description="Kar/Zarar ($)")
    pnl_percent: float = Field(..., description="Kar/Zarar (%)")
    exit_reason: str = Field(..., description="Çıkış nedeni (STOP/TARGET/SIGNAL)")


class EquityPoint(BaseModel):
    """Equity eğrisi noktası"""
    timestamp: str = Field(..., description="Zaman damgası")
    equity: float = Field(..., description="Bakiye ($)")


class BacktestMetrics(BaseModel):
    """Backtest metrikleri"""
    total_trades: int = Field(..., description="Toplam işlem sayısı")
    winning_trades: int = Field(..., description="Kazanan işlem sayısı")
    losing_trades: int = Field(..., description="Kaybeden işlem sayısı")
    win_rate: float = Field(..., description="Kazanma oranı (%)")
    net_pnl: float = Field(..., description="Net kar/zarar ($)")
    net_pnl_percent: float = Field(..., description="Net kar/zarar (%)")
    max_drawdown: float = Field(..., description="Maksimum düşüş (%)")
    avg_trade_pnl: float = Field(..., description="Ortalama işlem PnL ($)")
    avg_win: float = Field(..., description="Ortalama kazanç ($)")
    avg_loss: float = Field(..., description="Ortalama kayıp ($)")
    profit_factor: float = Field(..., description="Kar faktörü (Brüt Kar / Brüt Kayıp)")


class BacktestResponse(BaseModel):
    """Backtest yanıtı"""
    status: str = Field(..., description="Durum (success/error)")
    message: str = Field(..., description="Mesaj")
    metrics: BacktestMetrics = Field(..., description="Backtest metrikleri")
    equity_curve: List[EquityPoint] = Field(..., description="Equity eğrisi")
    recent_trades: List[TradeSummary] = Field(..., description="Son 10 işlem")
    total_days: int = Field(..., description="Test edilen gün sayısı")


# ============================================================================
# YARDIMCI FONKSİYONLAR
# ============================================================================

def clean_value(value: Any) -> Any:
    """
    NaN/Infinity değerlerini temizle.
    
    Args:
        value: Temizlenecek değer
        
    Returns:
        Temizlenmiş değer
    """
    if isinstance(value, float):
        if np.isnan(value) or np.isinf(value):
            return 0.0
        return round(value, 2)
    elif isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    return value


def generate_mock_data(
    symbol: str,
    timeframe: str,
    days: int
) -> pd.DataFrame:
    """
    Mock OHLCV verisi oluştur (test için).
    
    Args:
        symbol: Sembol (örn: BTC/USDT)
        timeframe: Zaman dilimi
        days: Gün sayısı
        
    Returns:
        pd.DataFrame: OHLCV verisi
    """
    # Timeframe'e göre mum sayısı
    if timeframe == "1m":
        bars_per_day = 1440
    elif timeframe == "5m":
        bars_per_day = 288
    elif timeframe == "15m":
        bars_per_day = 96
    elif timeframe == "1h":
        bars_per_day = 24
    elif timeframe == "4h":
        bars_per_day = 6
    elif timeframe == "1d":
        bars_per_day = 1
    else:
        bars_per_day = 24  # Varsayılan 1h
    
    n_rows = days * bars_per_day
    
    # Random walk fiyat simülasyonu
    np.random.seed(42)
    
    # Başlangıç fiyatı (sembol'e göre)
    if "BTC" in symbol:
        base_price = 50000
    elif "ETH" in symbol:
        base_price = 3000
    elif "BNB" in symbol:
        base_price = 300
    else:
        base_price = 100
    
    # Fiyat serisi (random walk)
    returns = np.random.randn(n_rows) * 0.001  # %0.1 günlük volatilite
    close_prices = base_price * np.cumprod(1 + returns)
    
    # OHLCV oluştur
    high_prices = close_prices * (1 + np.abs(np.random.randn(n_rows)) * 0.001)
    low_prices = close_prices * (1 - np.abs(np.random.randn(n_rows)) * 0.001)
    open_prices = close_prices * (1 + np.random.randn(n_rows) * 0.0005)
    volumes = np.random.randint(100, 10000, n_rows)
    
    # Zaman damgaları
    if timeframe == "1h":
        freq = "h"
    elif timeframe == "4h":
        freq = "4h"
    elif timeframe == "1d":
        freq = "d"
    else:
        freq = "h"  # Varsayılan
    
    index = pd.date_range(
        end=datetime.now(),
        periods=n_rows,
        freq=freq
    )
    
    # DataFrame oluştur
    df = pd.DataFrame({
        'open': open_prices,
        'high': high_prices,
        'low': low_prices,
        'close': close_prices,
        'volume': volumes
    }, index=index)
    
    # ATR ekle (basit - close'un %2'si)
    df['ATR_14'] = df['close'] * 0.02
    
    logger.info(f"📊 Mock data oluşturuldu: {len(df)} satır, {symbol} ({timeframe})")
    
    return df


def calculate_signals(df: pd.DataFrame, strategy_data: Dict[str, Any]) -> pd.Series:
    """
    Strateji JSON'undan sinyaller üret.
    
    Args:
        df: OHLCV verisi
        strategy_data: Strateji JSON
        
    Returns:
        pd.Series: Sinyaller (0=SAT, 1=BEKLE, 2=AL)
    """
    try:
        # Geçici JSON dosyası oluştur
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(strategy_data, f, indent=2, ensure_ascii=False)
            temp_json_path = f.name
        
        # StrategyExecutor'ı başlat
        executor = StrategyExecutor(temp_json_path)
        
        # Veriyi hazırla (indikatörleri hesapla)
        prepared_df = executor.prepare_data(df.copy())
        
        # Sinyalleri üret
        signals = []
        for i in range(len(prepared_df)):
            signal = executor.generate_signal(prepared_df.iloc[:i+1])
            signals.append(signal)
        
        # Geçici dosyayı temizle
        import os
        os.unlink(temp_json_path)
        
        return pd.Series(signals, index=df.index)
        
    except Exception as e:
        logger.error(f"❌ Sinyal hesaplama hatası: {e}")
        # Varsayılan: Hepsi BEKLE
        return pd.Series([1] * len(df), index=df.index)


# ============================================================================
# ENDPOINT'LER
# ============================================================================

@router.post("/run", response_model=BacktestResponse)
async def run_backtest(request: BacktestRequest):
    """
    Backtest çalıştır.
    
    Args:
        request: BacktestRequest (strategy, symbol, timeframe, days)
        
    Returns:
        BacktestResponse: Backtest sonuçları (metrics, equity_curve, trades)
        
    Raises:
        HTTPException: Backtest başarısızsa
    """
    try:
        logger.info(f"🧪 Backtest isteği: {request.symbol} ({request.timeframe}, {request.days} gün)")
        
        # 1. Strateji JSON'u al
        if request.strategy_filename:
            # Kaydedilmiş dosyadan yükle
            strategies_dir = Path("artifacts/strategies")
            filepath = strategies_dir / request.strategy_filename
            
            if not filepath.exists():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Strateji dosyası bulunamadı: {request.strategy_filename}"
                )
            
            with open(filepath, 'r', encoding='utf-8') as f:
                strategy_data = json.load(f)
        else:
            # Direkt JSON kullan
            strategy_data = request.strategy
        
        # 2. Veri çek (mock veya gerçek)
        # TODO: Gerçek veri için core/exchange.py veya veritabanından çek
        logger.info("📊 Veri çekiliyor...")
        df = generate_mock_data(request.symbol, request.timeframe, request.days)
        
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Veri alınamadı"
            )
        
        # 3. Sinyalleri üret
        logger.info("📈 Sinyaller hesaplanıyor...")
        signals = calculate_signals(df, strategy_data)
        
        # 4. Backtest çalıştır
        logger.info("⚙️ Backtest çalıştırılıyor...")
        backtester = VectorizedBacktester(
            initial_balance=request.initial_balance,
            fee_rate=0.0004,  # %0.04
            slippage=1.0001,  # %0.01
            risk_per_trade=request.risk_per_trade
        )
        
        risk_params = strategy_data.get('risk', {
            'stop_loss_atr_multiplier': 2.0,
            'take_profit_atr_multiplier': 4.0
        })
        
        result = backtester.run_backtest(df, signals, risk_params)
        
        # 5. Equity curve hazırla
        equity_curve = []
        equity_values = backtester.get_equity_curve()
        
        for i, equity in enumerate(equity_values):
            equity_curve.append(EquityPoint(
                timestamp=df.index[i].isoformat() if i < len(df.index) else datetime.now().isoformat(),
                equity=clean_value(equity)
            ))
        
        # 6. Recent trades hazırla (son 10 işlem)
        recent_trades = []
        for trade in result.trades[-10:]:
            recent_trades.append(TradeSummary(
                entry_time=clean_value(trade.entry_time),
                exit_time=clean_value(trade.exit_time),
                entry_price=clean_value(trade.entry_price),
                exit_price=clean_value(trade.exit_price),
                direction=trade.direction,
                pnl=clean_value(trade.pnl),
                pnl_percent=clean_value(trade.pnl_percent),
                exit_reason=trade.exit_reason
            ))
        
        # 7. Metrics hazırla
        metrics = BacktestMetrics(
            total_trades=clean_value(result.total_trades),
            winning_trades=clean_value(result.winning_trades),
            losing_trades=clean_value(result.losing_trades),
            win_rate=clean_value(result.win_rate),
            net_pnl=clean_value(result.net_pnl),
            net_pnl_percent=clean_value(result.net_pnl_percent),
            max_drawdown=clean_value(result.max_drawdown),
            avg_trade_pnl=clean_value(result.avg_trade_pnl),
            avg_win=clean_value(result.avg_win),
            avg_loss=clean_value(result.avg_loss),
            profit_factor=clean_value(result.profit_factor)
        )
        
        logger.info(f"✅ Backtest tamamlandı: {result.total_trades} işlem, Win Rate: {result.win_rate:.2f}%")
        
        return BacktestResponse(
            status="success",
            message=f"Backtest başarılı: {request.symbol} ({request.timeframe}, {request.days} gün)",
            metrics=metrics,
            equity_curve=equity_curve,
            recent_trades=recent_trades,
            total_days=request.days
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backtest hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backtest başarısız: {str(e)}"
        )


@router.get("/results/{backtest_id}")
async def get_backtest_results(backtest_id: str):
    """
    Backtest sonuçlarını al (opsiyonel - cache için).
    
    Args:
        backtest_id: Backtest ID
        
    Returns:
        Dict: Backtest sonuçları
    """
    # TODO: Cache implementasyonu
    return {
        "status": "error",
        "message": "Not implemented yet"
    }


@router.post("/optimize")
async def optimize_strategy(request: BacktestRequest):
    """
    Strateji optimizasyonu (Grid Search).
    
    Args:
        request: BacktestRequest
        
    Returns:
        Dict: Optimizasyon sonuçları
    """
    # TODO: Grid search implementasyonu
    return {
        "status": "error",
        "message": "Not implemented yet"
    }
