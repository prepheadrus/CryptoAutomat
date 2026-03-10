import os
import stat
from pathlib import Path
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger("CryptoAlgoBot")

# Şifreleme anahtarının saklanacağı gizli dosya
KEY_FILE = Path(".secret.key")

class KeyManager:
    def __init__(self):
        self.key = self._load_or_generate_key()
        self.cipher = Fernet(self.key)

    def _load_or_generate_key(self) -> bytes:
        """Anahtar dosyası varsa okur, yoksa yeni bir tane üretip güvenli kaydeder."""
        if KEY_FILE.exists():
            with open(KEY_FILE, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(KEY_FILE, "wb") as f:
                f.write(key)
            
            # Sadece dosya sahibinin okuma/yazma izni olsun (0o600 Linux/Mac)
            try:
                os.chmod(KEY_FILE, stat.S_IRUSR | stat.S_IWUSR)
            except Exception as e:
                logger.warning(f"Anahtar dosyası izinleri ayarlanamadı (Windows'ta normaldir): {e}")
            
            return key

    def encrypt(self, plaintext: str) -> str:
        return self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self.cipher.decrypt(ciphertext.encode()).decode()

# Sistemin genelinde kullanılacak Singleton instance
_key_manager = KeyManager()

def is_key_encrypted(key_string: str) -> bool:
    """Bir anahtarın Fernet ile şifreli olup olmadığını kontrol eder."""
    if not key_string:
        return False
    # Fernet token'ları varsayılan olarak 'gAAAAA' ile başlar
    return key_string.startswith("gAAAAA")

def encrypt_api_key(api_key: str) -> str:
    """Açık formdaki API anahtarını şifreler."""
    if not api_key or is_key_encrypted(api_key):
        return api_key
    return _key_manager.encrypt(api_key)

def decrypt_api_key(encrypted_key: str) -> str:
    """Şifreli API anahtarını RAM üzerinde anlık olarak çözer."""
    if not encrypted_key or not is_key_encrypted(encrypted_key):
        return encrypted_key
    try:
        return _key_manager.decrypt(encrypted_key)
    except Exception as e:
        logger.error(f"API Key çözümleme hatası: {e}")
        return encrypted_key