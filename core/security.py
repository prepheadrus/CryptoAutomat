"""
Security Module - API Key Encryption

Cryptography.fernet kullanarak AES-128-CBC şifreleme.
API anahtarları .env dosyasında şifreli olarak saklanır.
"""

import os
from pathlib import Path
from cryptography.fernet import Fernet
from core.logger import logger


# ============================================================================
# SABİTLER
# ============================================================================

SECRET_KEY_FILE = Path(".secret.key")
ENV_FILE = Path(".env")


# ============================================================================
# FONKSİYONLAR
# ============================================================================

def generate_key() -> bytes:
    """
    Yeni bir Fernet şifreleme anahtarı oluştur.
    
    Returns:
        bytes: 32-byte URL-safe base64-encoded key
    """
    key = Fernet.generate_key()
    
    # .secret.key dosyasına kaydet (sadece owner okuyabilir: 0o600)
    with open(SECRET_KEY_FILE, 'wb') as f:
        f.write(key)
    
    # Dosya izinlerini ayarla (Unix: 0o600, Windows: ignored)
    try:
        os.chmod(SECRET_KEY_FILE, 0o600)
        logger.info(f"✅ Şifreleme anahtarı oluşturuldu: {SECRET_KEY_FILE} (izinler: 0o600)")
    except Exception as e:
        logger.warning(f"⚠️ Dosya izinleri ayarlanamadı (Windows): {e}")
    
    return key


def load_key() -> bytes:
    """
    Mevcut şifreleme anahtarını yükle.
    Yoksa yeni anahtar oluştur.
    
    Returns:
        bytes: 32-byte URL-safe base64-encoded key
    """
    if SECRET_KEY_FILE.exists():
        with open(SECRET_KEY_FILE, 'rb') as f:
            key = f.read()
        logger.info(f"✅ Şifreleme anahtarı yüklendi: {SECRET_KEY_FILE}")
        return key
    else:
        logger.info("🔑 Şifreleme anahtarı bulunamadı, yeni anahtar oluşturuluyor...")
        return generate_key()


def get_fernet() -> Fernet:
    """
    Fernet instance oluştur.
    
    Returns:
        Fernet: Şifreleme/deşifreleme instance'ı
    """
    key = load_key()
    return Fernet(key)


def encrypt_api_key(api_key: str) -> str:
    """
    API anahtarını şifrele.
    
    Args:
        api_key: Düz metin API anahtarı
        
    Returns:
        str: Şifreli API anahtarı (base64-encoded)
    """
    try:
        fernet = get_fernet()
        encrypted = fernet.encrypt(api_key.encode('utf-8'))
        return encrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"❌ API anahtarı şifreleme hatası: {e}")
        raise


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Şifreli API anahtarını çöz.
    
    Args:
        encrypted_key: Şifreli API anahtarı (base64-encoded)
        
    Returns:
        str: Düz metin API anahtarı
    """
    try:
        fernet = get_fernet()
        decrypted = fernet.decrypt(encrypted_key.encode('utf-8'))
        return decrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"❌ API anahtarı çözme hatası: {e}")
        raise


def update_env_file(key: str, value: str):
    """
    .env dosyasına bir anahtar-değer çifti yaz/güncelle.
    
    Args:
        key: Anahtar adı (örn: BINANCE_API_KEY)
        value: Değer (örn: şifreli API key)
    """
    # .env dosyasını oku
    env_lines = []
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            env_lines = f.readlines()
    
    # Anahtarı bul ve güncelle veya ekle
    found = False
    for i, line in enumerate(env_lines):
        if line.strip().startswith(f"{key}="):
            env_lines[i] = f"{key}={value}\n"
            found = True
            logger.info(f"✅ .env dosyasında {key} güncellendi")
            break
    
    # Bulunamadıysa ekle
    if not found:
        env_lines.append(f"{key}={value}\n")
        logger.info(f"✅ .env dosyasına {key} eklendi")
    
    # .env dosyasına yaz
    with open(ENV_FILE, 'w', encoding='utf-8') as f:
        f.writelines(env_lines)
    
    logger.info(f"✅ .env dosyası güncellendi: {ENV_FILE}")


def get_api_key_from_env() -> tuple[str, str]:
    """
    .env dosyasından şifreli API anahtarlarını oku ve çöz.
    
    Returns:
        tuple: (api_key, api_secret) - düz metin
    """
    try:
        # .env dosyasından oku
        api_key_enc = os.getenv("BINANCE_API_KEY", "")
        api_secret_enc = os.getenv("BINANCE_API_SECRET", "")
        
        if not api_key_enc or not api_secret_enc:
            logger.warning("⚠️ API anahtarları .env dosyasında bulunamadı")
            return "", ""
        
        # Şifreyi çöz
        api_key = decrypt_api_key(api_key_enc)
        api_secret = decrypt_api_key(api_secret_enc)
        
        logger.info("✅ API anahtarları .env dosyasından yüklendi ve çözüldü")
        return api_key, api_secret
    except Exception as e:
        logger.error(f"❌ API anahtarları yüklenirken hata: {e}")
        return "", ""


# ============================================================================
# INIT (Modül yüklendiğinde çalışır)
# ============================================================================

# Modül ilk yüklendiğinde şifreleme anahtarını yükle
try:
    _ = load_key()
    logger.info("🔐 Security module initialized")
except Exception as e:
    logger.error(f"❌ Security module initialization failed: {e}")
