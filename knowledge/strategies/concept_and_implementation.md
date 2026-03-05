# 📐 Strateji Konseptleri ve Tasarım Modeli

Stratejiler botun "beyni" olmak yerine "kurallar listesini" temsil ederler. Beyin rolünü Yapay Zeka modeli yürütür. Bu sayede modüler bir mimari kurgulanmıştır.

## 1. İndikatör Ailesi Çatışmaları Önleme (Multicollinearity)
Piyasada uygulanan acemi stratejiler (RSI, Stoch, W%R'ı aynı anda kullanmak vb.) strateji mimarimizden tamamen dışlanmıştır.
Stratejilerimiz Temel Prensip olarak şu üçlü teyit mekanizmasını şart koşar:
- **Yön Bulucu:** MACD, Hareketli Ortalamalar (EMA/SMA)
- **Trend/Momentum Gücü:** ADX, RSI (Kendi özel sınırlarına göre)
- **Hacim Desteği:** OBV, VWAP, Koncorde (Kurumsal para girişi)

## 2. Mevcut Stratejilerimiz
1. **Trend Master Pro:** `SMA 20`, `EMA 200` ve `RSI 50+` ile 1 dakikalık trend takibi yapar. Son derece katıdır, EMA 200 altındaysa "AL" demez. Güvenlidir.
2. **Scalper Ninja:** Kısa periyotlar için tasarlanmış tepki botudur. `RSI 30 altı` + `Stochastic < 20 (Aşırı satım)` onayları ile dibi yakalar.
3. **Adaptive Koncorde X:** İspanyol Koncorde hacim osilatörü ile geliştirilmiştir. "Retail (Küçük Yatırımcı)" çıkıp "Azul (Balina - Kurumsal Para)" girdiğinde ve RSI gizli pozitif uyumsuzluk (veya güçlü zemin) yarattığında çalışır.
4. **Golden Combo:** Kaynak kitaba uygun %100 doğrulama serisidir. **Sıfırın üstünde MACD + `EMA(5) > SMA(20)` Kesişimi + Yükselen `ADX > 20` + `OBV > OBV_EMA` (Hacim rekoru)** aynı anda varsa tepki verir. Savaş kazanma oranı (Win-rate) teorik olarak çok yüksektir.

## 3. Yeni Strateji Ekleme Rehberi
1. `strategy/` klasöründe yeni bir `yeni_bot.py` oluşturun.
2. `BaseStrategy` sınıfını miras (inherit) alın. `generate_signal` metodunu ezin.
3. Sadece satırlardaki verilere bakın (`current_row['MACD...']`) ve `0`, `1`, `2` dönün.
4. `strategy/manager.py` içerisinde `STRATEGIES` sözlüğüne entegre edin. Sistemi yeniden başlatmanıza gerek kalmaz, anında UI'da (Arayüzde) görünür.
