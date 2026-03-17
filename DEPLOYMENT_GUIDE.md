# 🚀 CRYPTO ALGO BOT - PRODUCTION DEPLOYMENT GUIDE

## 📋 GENEL BAKIŞ

**setup.sh** betiği, CryptoAlgoBot'u Ubuntu sunucuda 7/24 kesintisiz çalışacak şekilde kurar.

### Özellikler
- ✅ OS ve Kantitatif Bağımlılık İzolasyonu
- ✅ Konfigürasyon ve Güvenlik Kalkanı
- ✅ Systemd Daemon Entegrasyonu (7/24 Uptime)
- ✅ Auto-Recovery (Çökme durumunda otomatik yeniden başlama)
- ✅ Boot'ta otomatik başlama
- ✅ Merkezi log yönetimi (journalctl)

---

## 🔧 KURULUM ADIMLARI

### 1. Ubuntu Sunucuya Bağlan

```bash
ssh user@your-ubuntu-server
```

### 2. Projeyi Klonla

```bash
cd ~
git clone https://github.com/prepheadrus/Crypto_Automat.git
cd Crypto_Automat
```

### 3. Setup Script'i Çalıştır

```bash
chmod +x setup.sh
./setup.sh
```

### 4. API Anahtarlarını Gir

Eğer `.env` dosyası yoksa, script sizi uyaracak:

```bash
nano .env
```

Şu anahtarları girin:
```bash
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_secret_here
```

### 5. Kurulumu Tamamla

```bash
./setup.sh
```

---

## 📊 SERVİS YÖNETİMİ

### Servis Durumu

```bash
sudo systemctl status cryptoalgobot
```

### Logları Canlı İzleme

```bash
journalctl -u cryptoalgobot.service -f
```

### Son 100 Satır Log

```bash
journalctl -u cryptoalgobot.service -n 100
```

### Bugünkü Loglar

```bash
journalctl -u cryptoalgobot.service --since today
```

### Servis Durdurma

```bash
sudo systemctl stop cryptoalgobot
```

### Servis Yeniden Başlatma

```bash
sudo systemctl restart cryptoalgobot
```

### Boot'ta Otomatik Başlamayı Aç/Kapat

```bash
# Enable (otomatik başlat)
sudo systemctl enable cryptoalgobot

# Disable (otomatik başlatma)
sudo systemctl disable cryptoalgobot
```

---

## 🔒 GÜVENLİK ÖZELLİKLERİ

### Systemd Hardening

```ini
NoNewPrivileges=true    # Yeni privilege kazanamaz
PrivateTmp=true         # Özel /tmp dizini
User=cryptoalgobot      # Root olmayan kullanıcı
Restart=always          # Çökme durumunda otomatik restart
RestartSec=10           # 10 saniye sonra restart
```

### API Key Koruması

- `.env` dosyası git'e eklenmez (`.gitignore`)
- API key'ler şifrelenmiş (`.env` içinde)
- Setup script API key eksikse durur

---

## 📝 LOG YÖNETİMİ

### Systemd Journal

```bash
# Canlı izleme
journalctl -u cryptoalgobot -f

# Son 1 saat
journalctl -u cryptoalgobot --since "1 hour ago"

# Belirli tarih aralığı
journalctl -u cryptoalgobot --since "2026-03-17 00:00:00" --until "2026-03-17 23:59:59"

# Sadece hatalar
journalctl -u cryptoalgobot -p err
```

### Bot Log Dosyaları

```bash
# Log dizini
ls -la ~/Crypto_Automat/logs/

# Son log
tail -f ~/Crypto_Automat/logs/bot.log
```

---

## 🛠️ SORUN GİDERME

### Servis Başlamıyor

```bash
# Durumu kontrol et
sudo systemctl status cryptoalgobot

# Detaylı log
journalctl -u cryptoalgobot -n 100 --no-pager

# Manuel başlat (test)
cd ~/Crypto_Automat
./venv/bin/python main.py
```

### Memory Leak

```bash
# Memory kullanımı
systemctl show cryptoalgobot | grep Memory

# Restart
sudo systemctl restart cryptoalgobot
```

### CPU Yüksek

```bash
# CPU kullanımı
top -u $USER

# Process ID
systemctl show cryptoalgobot --property MainPID
```

---

## 📊 PERFORMANS OPTİMİZASYONU

### Systemd Resource Limits

`/etc/systemd/system/cryptoalgobot.service` içinde:

```ini
# CPU priority (daha yüksek = daha fazla CPU)
Nice=-5

# Max open files
LimitNOFILE=65535

# Memory limit (opsiyonel)
# MemoryLimit=2G
```

### Python Optimizasyonu

```bash
# Environment variables
export PYTHONUNBUFFERED=1  # Log buffering kapalı
export PYTHONOPTIMIZE=2    # Optimizasyon seviyesi
```

---

## 🔄 GÜNCELLEME

### Kod Güncellemesi

```bash
cd ~/Crypto_Automat
git pull origin main

# Restart
sudo systemctl restart cryptoalgobot
```

### Bağımlılık Güncellemesi

```bash
cd ~/Crypto_Automat
./venv/bin/pip install -r requirements.txt --upgrade

# Restart
sudo systemctl restart cryptoalgobot
```

---

## 📈 İZLEME VE ALARM

### Health Check Script

```bash
#!/bin/bash
# health_check.sh

if ! systemctl is-active --quiet cryptoalgobot; then
    echo "CRITICAL: CryptoAlgoBot is down!"
    # Alerting (email, slack, telegram)
fi
```

### Cron Job (Her 5 dakikada)

```bash
crontab -e

# Her 5 dakikada health check
*/5 * * * * /home/user/Crypto_Automat/health_check.sh
```

---

## 🎯 DEPLOYMENT CHECKLIST

- [ ] Ubuntu 20.04/22.04 LTS
- [ ] Python 3.10+
- [ ] 4GB+ RAM
- [ ] 50GB+ Disk
- [ ] Internet bağlantısı
- [ ] Binance API keys
- [ ] `.env` dosyası yapılandırıldı
- [ ] `setup.sh` çalıştırıldı
- [ ] Servis aktif (`systemctl status`)
- [ ] Loglar görünüyor (`journalctl -f`)
- [ ] Boot'ta otomatik başlama (`systemctl enable`)

---

## 📞 DESTEK

### Log Gönderme

```bash
# Son 200 satır log
journalctl -u cryptoalgobot -n 200 > bot_log.txt

# Sistem bilgisi
uname -a > system_info.txt
python3 --version >> system_info.txt

# GitHub issue aç
# Log dosyalarını ekle
```

### Yaygın Hatalar

| Hata | Çözüm |
|------|-------|
| `API key eksik` | `.env` dosyasını düzenle |
| `Servis başlamıyor` | `journalctl -u cryptoalgobot -n 100` |
| `Memory leak` | `sudo systemctl restart cryptoalgobot` |
| `Bağımlılık hatası` | `./venv/bin/pip install -r requirements.txt` |

---

## ✅ BAŞARI KRİTERLERİ

- ✅ Servis çalışıyor: `systemctl is-active cryptoalgobot` → `active`
- ✅ Loglar görünüyor: `journalctl -u cryptoalgobot -f` → Canlı log akışı
- ✅ Boot'ta başlıyor: `systemctl is-enabled cryptoalgobot` → `enabled`
- ✅ Auto-recovery çalışıyor: `kill -9 <PID>` → Otomatik restart

---

**Son Güncelleme:** 2026-03-17  
**Versiyon:** 2026.03  
**Test Edildi:** Ubuntu 20.04 LTS, 22.04 LTS
