#!/bin/bash

# ==============================================================================
# CryptoAlgoBot - Otomatik Kurulum ve Başlatma Betiği (Ubuntu Linux)
# ==============================================================================

echo -e "\e[36m🚀 CryptoAlgoBot Kurulumu Başlıyor...\e[0m"

# 1. Sistem Paketlerini Güncelle
echo -e "\e[33m\n[1/5] Sistem güncellemeleri kontrol ediliyor...\e[0m"
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Python ve Gerekli Sistem Bağımlılıklarını Kur
echo -e "\e[33m\n[2/5] Python 3, pip ve sistem bağımlılıkları kuruluyor...\e[0m"
sudo apt-get install -y python3 python3-pip python3-venv build-essential python3-dev

# 3. Sanal Ortam (Virtual Environment) Oluşturma
echo -e "\e[33m\n[3/5] Python sanal ortamı (venv) oluşturuluyor...\e[0m"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "\e[32m✅ venv klasörü oluşturuldu.\e[0m"
else
    echo -e "\e[32m✅ venv klasörü zaten mevcut.\e[0m"
fi

# 4. Kütüphaneleri (Bağımlılıkları) Yükle
echo -e "\e[33m\n[4/5] Gerekli Python kütüphaneleri yükleniyor (requirements.txt)...\e[0m"
source venv/bin/activate
pip install --upgrade pip  # pip'in güncel versiyonunu kullanmak önemli
pip install -r requirements.txt

# .env dosyası kontrolü
if [ ! -f ".env" ]; then
    echo -e "\e[31m\n⚠️ .env dosyası bulunamadı. Lütfen .env.example dosyasından kopyalayarak oluşturun ve BINANCE_API_KEY gibi değerleri içini doldurun.\e[0m"
fi

echo -e "\e[32m\n✅[5/5] Kurulum Tamamlandı!\e[0m"
echo -e "=============================================================================="
echo -e "\e[36mBotu ve Dashboard'u Başlatmak İçin Arka Planda Aşağıdaki Komutu Çalıştırıyorum:\e[0m"
echo -e "\e[36mpython3 main.py\e[0m"
echo -e "=============================================================================="

# Sunucu kapanmasın diye nohup veya screen gibi bir araca ihtiyaç olabilir ancak test için normal çalıştırıyoruz.
unset DISPLAY # Linux terminal ortamında görsel arayüz kütüphane hatalarını engellemek için

python3 main.py
