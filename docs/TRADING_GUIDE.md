# Trading System Guide

## Genel Bakış

CryptoAutomat, Binance borsasında otomatik kripto para ticareti yapmanıza olanak tanıyan bir bot platformudur. Hem spot hem de futures (kaldıraçlı) ticareti destekler.

## Özellikler

- ✅ **Binance Entegrasyonu**: Doğrudan Binance API ile bağlantı
- ✅ **Testnet Desteği**: Gerçek para riski olmadan test etme
- ✅ **Görsel Strateji Editörü**: Sürükle-bırak ile strateji oluşturma
- ✅ **TradingView Webhook**: TradingView sinyalleriyle otomatik işlem
- ✅ **Paper Trading**: Simülasyon modu ile risk-free testing
- ✅ **Teknik İndikatörler**: RSI, SMA, EMA, MACD desteği
- ✅ **Risk Yönetimi**: Stop loss, take profit, trailing stop

## Kurulum

### 1. Binance API Anahtarları Oluşturma

#### Testnet (Önerilen - İlk Test İçin):
1. [Binance Testnet](https://testnet.binance.vision/) adresine gidin
2. GitHub ile giriş yapın
3. "Generate HMAC_SHA256 Key" butonuna tıklayın
4. API Key ve Secret Key'i kopyalayın

#### Mainnet (Canlı İşlemler):
1. [Binance](https://www.binance.com/) hesabınıza giriş yapın
2. Profil → API Management'e gidin
3. "Create API" butonuna tıklayın
4. API Key ve Secret Key'i güvenli bir yerde saklayın
5. IP kısıtlaması ekleyin (önerilen)
6. Yetkileri ayarlayın:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading
   - ⚠️ Enable Futures (sadece futures kullanacaksanız)

### 2. API Anahtarlarını Ekleme

1. CryptoAutomat uygulamasında Settings sayfasına gidin
2. Binance API Key ve Secret Key'i girin
3. Testnet kullanıyorsanız "Testnet" seçeneğini işaretleyin
4. "Test Connection" butonuna tıklayın
5. Bağlantı başarılıysa anahtarlar kaydedilir

## Kullanım

### Strateji Oluşturma

1. **Strategy Editor** sayfasına gidin
2. Sol menüden node'ları sürükleyip bırakın:
   - **Data Source**: Veri kaynağı (OHLCV, Price)
   - **Indicator**: Teknik indikatör (RSI, SMA, EMA, MACD)
   - **Logic**: Koşul kontrolü (>, <, =)
   - **Action**: İşlem (BUY, SELL)
3. Node'ları birbirine bağlayın
4. Stratejiyi kaydedin

### Bot Oluşturma ve Çalıştırma

#### Manuel Bot Çalıştırma:
1. Strategy Editor'de stratejinizi oluşturun
2. "Backtest" ile stratejinizi test edin
3. "Save Strategy" ile botu kaydedin
4. Bot Status sayfasına gidin
5. Bot'u seçin ve "Start" butonuna tıklayın

#### TradingView ile Webhook Kullanımı:
1. Bot Status sayfasında bot'unuzun webhook URL'ini kopyalayın
2. TradingView'da bir alert oluşturun
3. Webhook URL'i yapıştırın
4. Alert mesajında şu formatı kullanın:

```json
{
  "botId": 1234,
  "secret": "bot-webhook-secret-uuid",
  "action": "buy",
  "symbol": "BTCUSDT",
  "amount": 100
}
```

## API Endpoints

### 1. Test API Keys
**Endpoint**: `POST /api/test-keys`

Binance API anahtarlarını test eder.

**Request Body**:
```json
{
  "apiKey": "your-api-key",
  "secretKey": "your-secret-key",
  "testnet": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "API anahtarları geçerli ve trading is enabled.",
  "accountInfo": {
    "canTrade": true,
    "canWithdraw": false,
    "canDeposit": true
  },
  "testnet": false
}
```

### 2. Execute Trade
**Endpoint**: `POST /api/execute-trade`

Doğrudan bir işlem gerçekleştirir (spot trading).

**Request Body**:
```json
{
  "apiKey": "your-api-key",
  "secretKey": "your-secret-key",
  "testnet": false,
  "symbol": "BTCUSDT",
  "side": "BUY",
  "type": "MARKET",
  "quoteOrderQty": 100
}
```

**Response**:
```json
{
  "success": true,
  "message": "BUY order başarıyla yerleştirildi.",
  "order": {
    "orderId": 12345,
    "symbol": "BTCUSDT",
    "side": "BUY",
    "type": "MARKET",
    "executedQty": "0.00156",
    "status": "FILLED"
  }
}
```

### 3. Run Bot
**Endpoint**: `POST /api/run-bot`

Bir bot stratejisini çalıştırır ve sinyale göre işlem yapar.

**Request Body**:
```json
{
  "nodes": [...],
  "edges": [...],
  "apiKey": "your-api-key",
  "secretKey": "your-secret-key",
  "symbol": "BTCUSDT",
  "mode": "LIVE"
}
```

**Response**:
```json
{
  "success": true,
  "message": "[CANLI] Karar: BUY. Koşul sağlandı (RSI 28.5 lt 30).",
  "decision": "BUY",
  "data": {
    "indicatorValue": 28.5,
    "thresholdValue": 30,
    "currentPrice": 64250,
    "order": {...}
  }
}
```

### 4. Webhook (TradingView)
**Endpoint**: `POST /api/webhook`

TradingView alert'lerini alır ve işlem gerçekleştirir.

**Request Body**:
```json
{
  "botId": 1234,
  "secret": "d9e1e247-6063-4a32-9a3b-9b4f7e2a4c24",
  "action": "buy",
  "symbol": "BTCUSDT",
  "amount": 100,
  "leverage": 5
}
```

**Response**:
```json
{
  "success": true,
  "message": "Trade executed successfully"
}
```

## Güvenlik Önlemleri

### API Anahtarları
- ⚠️ **API anahtarlarınızı asla paylaşmayın**
- ✅ IP kısıtlaması ekleyin (Binance API ayarlarından)
- ✅ Sadece gerekli yetkileri verin (trading, reading)
- ⚠️ **Withdrawal yetkisi vermeyin**
- ✅ Düzenli olarak anahtarları yenileyin

### Webhook Güvenliği
- ✅ Her bot için unique webhook secret kullanılır
- ✅ Webhook URL'leri kimseyle paylaşmayın
- ✅ Şüpheli aktivite durumunda botu durdurun

### İşlem Güvenliği
- ✅ **İlk önce Testnet ile test edin**
- ✅ Küçük miktarlarla başlayın
- ✅ Stop loss kullanın
- ✅ Risk yönetimi ayarlarını mutlaka yapın
- ⚠️ Tüm sermayenizi tek bir bota yatırmayın

## Sık Karşılaşılan Hatalar

### "Invalid API-key"
- API key veya secret key yanlış girilmiş
- IP kısıtlaması varsa IP adresiniz listeye eklenmemiş
- API key silinmiş veya devre dışı bırakılmış

### "Insufficient balance"
- Hesabınızda yeterli bakiye yok
- İşlem tutarı minimum gereksinimlerden düşük

### "MIN_NOTIONAL"
- İşlem tutarı Binance'in minimum tutarının altında
- En az 10-15 USDT değerinde işlem yapmanız gerekiyor

### "Signature verification failed"
- Secret key yanlış
- Sistem saati senkronize değil
- Timestamp sorunu (nadir)

## Paper Trading vs Live Trading

### Paper Trading (Simülasyon)
- ✅ Risk yok - gerçek para kullanılmaz
- ✅ Strateji testleri için ideal
- ✅ Sınırsız deneme
- ⚠️ Gerçek piyasa koşullarını tam yansıtmaz

### Live Trading (Canlı İşlemler)
- ⚠️ Gerçek para riski var
- ✅ Gerçek piyasa koşulları
- ✅ Gerçek kar/zarar
- ⚠️ Dikkatli risk yönetimi gerektirir

## İyi Uygulamalar

1. **Test, Test, Test**
   - Her zaman testnet ile başlayın
   - Paper trading ile stratejiyi test edin
   - Küçük miktarlarla canlıya geçin

2. **Risk Yönetimi**
   - Her işleme stop loss koyun
   - Portföyünüzün %1-2'sinden fazlasını riske atmayın
   - Diversifikasyon yapın (farklı coin'ler, farklı stratejiler)

3. **Monitoring**
   - Bot'ları düzenli olarak kontrol edin
   - Log'ları takip edin
   - Performans metriklerini analiz edin

4. **Güncelleme**
   - Stratejiyi piyasa koşullarına göre güncelleyin
   - Performans düşerse botu durdurup analiz edin

## Destek

Sorun yaşarsanız:
1. Konsol log'larını kontrol edin
2. API anahtarlarının geçerli olduğundan emin olun
3. Binance API status sayfasını kontrol edin
4. GitHub issues'a sorun bildirin

## Sorumluluk Reddi

⚠️ **ÖNEMLİ**: Kripto para ticareti yüksek risk içerir. Bu yazılım "olduğu gibi" sunulmaktadır ve hiçbir garanti verilmemektedir. Yazılımı kullanarak oluşabilecek tüm kayıplardan kendiniz sorumlusunuz. Kaybetmeyi göze alamayacağınız parayla işlem yapmayın.
