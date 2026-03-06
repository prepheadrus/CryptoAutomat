# ARCHITECTURE BILGI BANKASI
Son Guncelleme: 06/03/2026 19:28

---



## KAYNAK DOSYA: data_pipeline.md

# 🧪 Veri Boru Hattı (Data Pipeline) ve Özellik Mühendisliği

Verinin borsadan akıp Yapay Zekaya (ML) sunulduğu hayati damardır.

## 1. Merkezileştirilmiş İndikatör Motoru (`data/indicators.py`)

Tüm sistemin matematik fabrikası burasıdır. Stratejiler içerisinde indikatör hesaplanmaz. Veri önce buraya girer, "Zenginleştirilir" (Feature Engineering) ve süslenmiş bir Excel (DataFrame) tablosu halinde dışarı çıkar.

### İndikatör Hesaplama Yöntemleri

**Öncelik Sırası:**
1. **TA-Lib** (C tabanlı, en hızlı) - Opsiyonel
2. **Manuel Hesaplama** (numpy/pandas) - Varsayılan

**Desteklenen İndikatörler:**

| Kategori | İndikatörler |
|----------|--------------|
| **Trend** | EMA, SMA, Kalman Filter, Supertrend, EWO |
| **Momentum** | RSI, MACD, Stochastic, UO |
| **Volatilite** | ATR, Bollinger Bands, BTC VIX |
| **Hacim** | OBV, VWAP, PVI, NVI, Koncorde |
| **Diğer** | ADX, PSAR, Demand Index, KNN |

### Manuel Hesaplama (pandas-ta Gerektirmez)

```python
# Örnek: RSI hesaplama
def rsi(series, length=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=length).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=length).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))
```

**Avantajlar:**
- ✅ Hiçbir external kütüphane gerektirmez
- ✅ Cross-platform (Windows, Linux, Mac)
- ✅ Derleme sorunları yok
- ✅ Kolayca yeni indikatör eklenebilir


## 2. Zaman Dilimi Dönüştürme (Resampling)
Uygulama arka planda Binance'dan hep 1D veya 1H değil, **1m (1 Dakikalık)** en saf (granüler) veriyi indirir. 
Kullanıcı Arayüz üzerinden `15m` simülasyonu çalıştır dediğinde, `indicators.py` sistem içindeki `resample_data` fonksiyonuyla o saniye (Milisaniyeler içinde) milyarlarca işlemi kaydırarak doğru birleştirir, 1 dakikalık mumlardan mükemmel bir "15 Dakikalık" veri tablosu çıkarır. Böylelikle borsaya "Bana 15m yolla, dur vazgeçtim 1H yolla" diye Spamlama (Banned/Limit Exceeded yeme) riskini ortadan kaldırır.

## 3. Veri Güvenliği ve Uyumluluğu
Veriler C (XGBoost) modeline ve ardından Frontend'e (Javascript) taşınırken `NaN`, `Infinity`, `-Infinity` gibi Python nesneleri büyük hatalar (500 Internal Error / JSON Decode Error) verir.
Bu sebeple `df.replace([np.inf, -np.inf], np.nan).fillna(0)` mantığı veri hattının güvenlik kilididir.
Zaman formatlarının Linux Epoch Date veya DateTime object karmaşıklığı yaratmasını önlemek adına Merkezi bir `ensure_ms(timestamp)` algoritması tüm sistemi senkronize milisaniyelere bağlar.


---


## KAYNAK DOSYA: overview.md

# 🏛 Sistem Mimarisi Genel Bakış (Architecture Overview)

Crypto Algo Bot projesi, modern veri mühendisliği, yapay zeka ve modüler yazılım prensipleriyle (Python & FastAPI) inşa edilmiş bir algoritmik ticaret ve analiz motorudur.

## 1. Katmanlı Yapı (Layered Architecture)

Sistem **5 Temel Katmandan** oluşur:
1. **Veri Sağlayıcı Katmanı (Data Provider):** `core/exchange.py`
   - CCXT kütüphanesi aracılığıyla Binance borsasına bağlanır.
   - Periyodik (Asynchronous Poller) olarak seçili coinlerin mum (OHLCV) verilerini sömürür.
2. **Özellik Çıkarımı Katmanı (Feature Engineering):** `data/indicators.py`
   - Alınan ham mum verilerinin üzerine teknik analiz modülleri oturtulur.
   - `pandas_ta` kütüphanesi merkezi olarak kullanılırken, Koncorde ve Kalman Filtresi gibi kütüphanesi olmayan kompleks denklemler özel algoritmalarla çözülüp sütun olarak eklenir.
3. **Teknik Karar Katmanı (Strategy Core):** `strategy/`
   - Tamamen izole edilmiş, safça "Kurallar Bütünü" barındıran katmandır. Trend Master, Golden Combo gibi şablonlar burada barınır. Sadece 0(SAT), 1(BEKLE), 2(AL) sinyali üretirler.
4. **Yapay Zeka & Simülasyon Katmanı (ML Inference & Paper Trade):** `api/server.py` & `core/paper.py`
   - Geçmiş stratejik kararları alan Yapay Zeka (XGBoost) tahminiyle, stratejiden gelen "AL" sinyalinin uyumlu (Konfluans) olduğu noktalarda `PaperTrader` motoruna emir iletilir.
   - Bu emir komisyon, sınır, bakiye, ve risk hesaplarından (Dinamik Kaldıraç & ATR) geçerek işlem dosyasına yazılır.
5. **Sunum Katmanı (Frontend):** `frontend/`
   - Kullanıcının doğrudan gördüğü vitrindir. TradingView Lightweight Charts entegredir. Lejantlar, interaktif tooltipler ve dinamik ondalık hesaplamalarla tam gerçekçi bir borsa terminali hissiyatı sunar.

## Temel Çalışma Döngüsü (Workflow)

[Binance'dan Ham Veri] 
      -> [indicators.py ile Veriyi Zenginleştir (MACD, ADX, VIX...)]
             -> [XGBoost Model Tahmini (0, 1, 2) + Güven Skoru] 
             -> [Seçili Strateji (Örn: Golden Combo) Kuralları Onayı (0, 1, 2)]
                    => {EĞER HER İKİSİ DE 2 VE GÜVEN > %65 İSE}
                           -> [PaperTrader'a Gönder -> Komisyon / Kayma Hesabı -> İŞLEME GİR]


---
