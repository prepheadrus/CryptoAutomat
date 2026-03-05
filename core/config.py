import os
import yaml
from dotenv import load_dotenv
from pathlib import Path

# Proje ana dizinini belirle
BASE_DIR = Path(__file__).resolve().parent.parent

# Çevresel değişkenleri yükle (.env)
env_path = BASE_DIR / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path, override=True)

# yaml konfigürasyon dosyasını yükle
config_path = BASE_DIR / 'config.yaml'

def load_config():
    if not config_path.exists():
        raise FileNotFoundError(f"Konfigürasyon dosyası bulunamadı: {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as file:
        return yaml.safe_load(file)

CONFIG = load_config()

# Çevresel Değişkenler Sabitleri
BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET", "")
TIMESCALE_DB_URL = os.getenv("TIMESCALE_DB_URL", "")
REDIS_URL = os.getenv("REDIS_URL", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
