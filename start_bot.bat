import os

# 1. Ayarlar: Kaynak klasör ve çıktı dosyasının yolları
kaynak_klasor = r"F:\Crypto Bot"

# Çıktı dosyasını ana klasörün içine veya dışına kaydedebilirsin.
# Karışıklık olmaması için doğrudan F: dizinine kaydediyoruz.
cikis_dosyasi = r"F:\Crypto_Bot_Tum_Dokumanlar.md" 

# Kendi kendini okumasını engellemek için çıktı dosyasının adını alıyoruz
cikis_dosyasi_adi = os.path.basename(cikis_dosyasi)

islenen_dosya_sayisi = 0

print(f"Tarama başlatılıyor: {kaynak_klasor} ...\n")

# Yeni (veya üzerine yazılacak) çıktı dosyasını oluştur
with open(cikis_dosyasi, "w", encoding="utf-8") as cikis:
    cikis.write("# 📚 CryptoAlgoBot Tüm Bilgi Bankası ve Dokümanlar\n")
    cikis.write("Bu dosya sistemdeki tüm `.md` dosyalarının otomatik olarak birleştirilmesiyle oluşturulmuştur.\n\n---\n")

    # os.walk ile tüm alt klasörleri ağaç yapısında tarıyoruz
    for kok_dizin, alt_klasorler, dosyalar in os.walk(kaynak_klasor):
        for dosya in dosyalar:
            
            # Sadece .md uzantılı dosyaları al ve çıktı dosyasının kendisini atla
            if dosya.endswith(".md") and dosya != cikis_dosyasi_adi:
                dosya_yolu = os.path.join(kok_dizin, dosya)
                
                # Dosyanın projedeki göreceli (relative) yolunu bul (Örn: "klasor1\dosya.md")
                goreceli_yol = os.path.relpath(dosya_yolu, kaynak_klasor)
                
                # 1. Başlık Ekleme: Dosyanın yolunu başlık olarak yaz
                cikis.write(f"\n\n# 📄 {goreceli_yol}\n\n")
                
                # 2. İçeriği Okuma ve Yazma
                try:
                    with open(dosya_yolu, "r", encoding="utf-8") as d:
                        icerik = d.read()
                        cikis.write(icerik)
                        
                        # 3. Dosyalar arasına ayırıcı çizgi çek
                        cikis.write("\n\n---\n")
                        
                        islenen_dosya_sayisi += 1
                        print(f"Eklendi: {goreceli_yol}")
                except Exception as e:
                    print(f"⚠️ Hata: {goreceli_yol} okunamadı. Detay: {e}")

print(f"\n✅ İşlem tamamlandı! Toplam {islenen_dosya_sayisi} adet Markdown dosyası başarıyla birleştirildi.")
print(f"📁 Birleştirilmiş Dosya Konumu: {cikis_dosyasi}")