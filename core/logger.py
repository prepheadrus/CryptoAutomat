import logging
import colorlog
from core.config import CONFIG

def setup_logger(name='CryptoAlgoBot'):
    """Merkezi, renk detaylı loglama yapılandırması."""
    logger = logging.getLogger(name)
    
    # Log seviyesini config.yaml'dan belirle
    log_level_str = CONFIG.get('bot', {}).get('log_level', 'INFO').upper()
    log_level = getattr(logging, log_level_str, logging.INFO)
    logger.setLevel(log_level)
    
    # Eğer önceden eklenmiş bir handler (işleyici) varsa, tekrar ekleme
    if not logger.handlers:
        console_handler = colorlog.StreamHandler()
        console_handler.setLevel(log_level)

        # Konsol formatı: Renkli ve zaman detaylı
        formatter = colorlog.ColoredFormatter(
            "%(log_color)s%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt='%Y-%m-%d %H:%M:%S',
            reset=True,
            log_colors={
                'DEBUG':    'cyan',
                'INFO':     'green',
                'WARNING':  'yellow',
                'ERROR':    'red',
                'CRITICAL': 'red,bg_white',
            },
            secondary_log_colors={},
            style='%'
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger

# Logger örneği kullanımı için hazır
logger = setup_logger()
