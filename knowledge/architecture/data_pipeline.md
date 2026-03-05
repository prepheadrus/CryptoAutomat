# 🧪 Veri Boru Hattı (Data Pipeline) ve Özellik Mühendisliği

Verinin borsadan akıp Yapay Zekaya (ML) sunulduğu hayati damardır.

## 1. Merkezileştirilmiş İndikatör Motoru (`data/indicators.py`)
Tüm sistemin matematik fabrikası burasıdır. Stratejiler içerisinde indikatör hesaplanmaz. Veri önce buraya girer, "Zenginleştirilir" (Feature Engineering) ve süslenmiş bir Excel (DataFrame) tablosu halinde dışarı çıkar.

Mimarisi `pandas_ta` isimli, C tabanlı son derece hızlı (optimize) bir formül bazına oturur.
- Basit ve Standart yapılar (RSI, Stochastic, ADX, Bollinger) kütüphaneden tek satırla çekilir.
- Karmaşık, piyasada bulunmayan indikatörler (Kalman Filtresi, İspanyol Koncorde Osilatörü) Python içerisinde *Özel Döngüler (Custom Logic)* tasarlanarak eklenir.

## 2. Zaman Dilimi Dönüştürme (Resampling)
Uygulama arka planda Binance'dan hep 1D veya 1H değil, **1m (1 Dakikalık)** en saf (granüler) veriyi indirir. 
Kullanıcı Arayüz üzerinden `15m` simülasyonu çalıştır dediğinde, `indicators.py` sistem içindeki `resample_data` fonksiyonuyla o saniye (Milisaniyeler içinde) milyarlarca işlemi kaydırarak doğru birleştirir, 1 dakikalık mumlardan mükemmel bir "15 Dakikalık" veri tablosu çıkarır. Böylelikle borsaya "Bana 15m yolla, dur vazgeçtim 1H yolla" diye Spamlama (Banned/Limit Exceeded yeme) riskini ortadan kaldırır.

## 3. Veri Güvenliği ve Uyumluluğu
Veriler C (XGBoost) modeline ve ardından Frontend'e (Javascript) taşınırken `NaN`, `Infinity`, `-Infinity` gibi Python nesneleri büyük hatalar (500 Internal Error / JSON Decode Error) verir.
Bu sebeple `df.replace([np.inf, -np.inf], np.nan).fillna(0)` mantığı veri hattının güvenlik kilididir.
Zaman formatlarının Linux Epoch Date veya DateTime object karmaşıklığı yaratmasını önlemek adına Merkezi bir `ensure_ms(timestamp)` algoritması tüm sistemi senkronize milisaniyelere bağlar.
