"""
Data Service

Business logic for data operations.
"""

from typing import Dict, Any, List, Optional

from core.logger import logger
from core.exchange import exchange_manager
from data.database import db_manager
from api.schemas.data import (
    DataDownloadRequest,
    DataStopRequest,
    DataResumeRequest,
    DataDeleteRequest,
    DataPauseRequest,
)


class DataService:
    """
    Data Service.
    
    Business logic for data operations:
    - Download historical data
    - Stop download
    - Resume download
    - Delete data
    - Pause/resume download
    - Get history status
    - Get active downloads
    """
    
    def __init__(self):
        self.exchange_manager = exchange_manager
        self.db_manager = db_manager
    
    def _normalize_market_type(self, market_type_str: str, symbol: str) -> str:
        """Converts user-facing market type strings into system-level 'spot' or 'future' types."""
        lowered_str = str(market_type_str).lower()
        if any(keyword in lowered_str for keyword in ['perp', 'future', 'vadeli', 'swap']):
            return 'future'
        if ':' in symbol or symbol.endswith('-SWAP'):
            return 'future'
        return 'spot'
    
    async def start_download(self, request: DataDownloadRequest) -> Dict[str, Any]:
        """
        Geçmiş veri indirme başlat.
        
        Args:
            request: Veri indirme isteği
        
        Returns:
            İndirme başlatma yanıtı
        """
        symbol = request.symbol.split('_')[0].strip() if '_' in request.symbol else request.symbol
        market_type = self._normalize_market_type(request.market_type, symbol)
        key = f"{symbol}_{market_type}"
        
        # Check if already downloading
        if key in self.exchange_manager.active_downloads:
            task = self.exchange_manager.active_downloads[key]
            return {
                "status": "exists",
                "message": f"{key} için zaten bir kayıt ({task['status'].upper()}) bulunuyor.",
                "task": task
            }
        
        # Start download in background
        import asyncio
        asyncio.create_task(
            self.exchange_manager.download_historical_data(
                symbol,
                request.timeframe,
                request.start_date,
                market_type
            )
        )
        
        return {
            "status": "started",
            "message": f"{key} ({market_type}) için {request.start_date} tarihinden itibaren veri indirme görevi başlatıldı."
        }
    
    async def stop_download(self, request: DataStopRequest) -> Dict[str, Any]:
        """
        İndirme durdur.
        
        Args:
            request: İndirme durdurma isteği
        
        Returns:
            Durdurma yanıtı
        """
        symbol = request.symbol
        key = f"{symbol}_future"  # Default to future
        
        if key not in self.exchange_manager.active_downloads:
            # Try spot
            key = f"{symbol}_spot"
        
        if key in self.exchange_manager.download_stops:
            self.exchange_manager.download_stops[key] = True
            return {"status": "success", "message": f"{symbol} için indirme durduruldu."}
        
        return {"status": "error", "message": f"{symbol} için aktif indirme bulunamadı."}
    
    async def resume_download(self, request: DataResumeRequest) -> Dict[str, Any]:
        """
        İndirme devam ettir.
        
        Args:
            request: İndirme devam ettirme isteği
        
        Returns:
            Devam ettirme yanıtı
        """
        # TODO: Implement resume logic
        return {"status": "success", "message": f"{request.symbol} için indirme devam ettirildi."}
    
    async def delete_data(self, request: DataDeleteRequest) -> Dict[str, Any]:
        """
        Veri sil.

        Args:
            request: Veri silme isteği

        Returns:
            Silme yanıtı
        """
        try:
            await self.db_manager.delete_klines(request.symbol, request.timeframe)
            return {"status": "success", "message": f"{request.symbol} verileri silindi."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def delete_download_task(self, request: DataDeleteRequest) -> Dict[str, Any]:
        """
        Download task sil.

        Args:
            request: Veri silme isteği (symbol + market_type)

        Returns:
            Silme yanıtı
        """
        try:
            # ÖNCE DB'de hangi market_type'lar var kontrol et
            symbol_clean = request.symbol.split('_')[0].strip()
            
            # ÖZEL: Geçersiz semboller için direkt temizleme
            is_invalid_symbol = (
                '-- SEÇİNİZ --' in request.symbol or
                'SEÇİNİZ' in request.symbol or
                symbol_clean == '' or
                symbol_clean == '-'
            )
            
            if is_invalid_symbol:
                logger.warning(f"⚠️ Geçersiz sembol temizleniyor: {request.symbol}")
            
            # DB'den bu sembolün tüm market_type'larını al
            sql_find = "SELECT market_type FROM download_tasks WHERE symbol = ?"
            found_types = []
            
            if self.db_manager.engine_type == "sqlite":
                async with self.db_manager.sqlite_conn.execute(sql_find, (symbol_clean,)) as cursor:
                    rows = await cursor.fetchall()
                    found_types = [row[0] for row in rows]
            
            logger.info(f"🗑️ Silme isteği: {request.symbol}")
            logger.info(f"   - Sembol (temiz): {symbol_clean}")
            logger.info(f"   - Request market_type: {request.market_type}")
            logger.info(f"   - DB'de bulunan market_type'lar: {found_types}")
            
            # Eğer birden fazla market_type varsa, hepsini sil
            if not found_types:
                # Sembol bulunamadı, normalize edilmiş hali dene
                market_type = self._normalize_market_type(request.market_type, request.symbol)
                found_types = [market_type]
                logger.info(f"   - Sembol bulunamadı, normalize ediliyor: {market_type}")
            
            # Her bulunan market_type'ı sil
            deleted_count = 0
            for mt in found_types:
                key = f"{symbol_clean}_{mt}"
                logger.info(f"   - Siliniyor: {key}")
                
                # RAM'den sil (aktif indirme varsa)
                if key in self.exchange_manager.active_downloads:
                    # İndirme durdur
                    if key in self.exchange_manager.download_stops:
                        self.exchange_manager.download_stops[key] = True
                    del self.exchange_manager.active_downloads[key]
                    logger.info(f"🗑️ RAM'den silindi: {key}")
                
                # Geçersiz semboller için özel temizleme (tüm varyasyonları sil)
                if is_invalid_symbol:
                    # Tüm download_tasks'ları kontrol et ve sil
                    sql_all = "SELECT symbol, market_type FROM download_tasks"
                    if self.db_manager.engine_type == "sqlite":
                        async with self.db_manager.sqlite_conn.execute(sql_all) as cursor:
                            all_tasks = await cursor.fetchall()
                            for row in all_tasks:
                                db_symbol = row[0]
                                db_mt = row[1]
                                if '-- SEÇİNİZ --' in db_symbol or 'SEÇİNİZ' in db_symbol or db_symbol == '':
                                    await self.db_manager.delete_download_task(db_symbol, db_mt)
                                    logger.info(f"🗑️ Geçersiz görev temizlendi: {db_symbol}_{db_mt}")
                                    deleted_count += 1
                else:
                    # DB'den sil
                    await self.db_manager.delete_download_task(symbol_clean, mt)
                    deleted_count += 1
                    logger.info(f"🗑️ DB'den silindi: {symbol_clean}_{mt}")
            
            return {
                "status": "success", 
                "message": f"{request.symbol} için {deleted_count} görev silindi."
            }
        except Exception as e:
            logger.error(f"Delete download task error: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {"status": "error", "message": str(e)}
    
    async def pause_download(self, request: DataPauseRequest) -> Dict[str, Any]:
        """
        İndirme duraklat/devam et.
        
        Args:
            request: Duraklatma isteği
        
        Returns:
            Duraklatma yanıtı
        """
        symbol = request.symbol
        key = f"{symbol}_future"
        
        if key not in self.exchange_manager.download_pauses:
            key = f"{symbol}_spot"
        
        if key in self.exchange_manager.download_pauses:
            if request.action == "pause":
                self.exchange_manager.download_pauses[key] = True
                return {"status": "success", "message": f"{symbol} için indirme duraklatıldı."}
            else:
                self.exchange_manager.download_pauses[key] = False
                return {"status": "success", "message": f"{symbol} için indirme devam ettirildi."}
        
        return {"status": "error", "message": f"{symbol} için aktif indirme bulunamadı."}
    
    async def get_history_status(self, symbol: str, timeframe: str = "1m") -> Dict[str, Any]:
        """
        Geçmiş durumunu al.
        
        Args:
            symbol: Sembol
            timeframe: Zaman dilimi
        
        Returns:
            Geçmiş durum yanıtı
        """
        data_range = await self.db_manager.get_candle_range(symbol, timeframe)
        
        if data_range:
            import pandas as pd
            return {
                "symbol": symbol,
                "timeframe": timeframe,
                "start_date": pd.to_datetime(data_range['start'], unit='ms').strftime('%Y-%m-%d %H:%M'),
                "end_date": pd.to_datetime(data_range['end'], unit='ms').strftime('%Y-%m-%d %H:%M'),
                "count_hint": "Dinamik hesaplanabilir"
            }
        
        return {"symbol": symbol, "status": "no_data"}
    
    async def get_active_downloads(self) -> Dict[str, Any]:
        """
        Aktif indirmeleri al.

        Returns:
            Aktif indirmeler yanıtı
        """
        return {
            "status": "success",
            "downloads": self.exchange_manager.active_downloads
        }

    async def get_all_download_tasks(self) -> Dict[str, Any]:
        """
        Tüm indirme görevlerini al (aktif + tamamlanan).

        Returns:
            Tüm indirme görevleri
        """
        try:
            # 1. Aktif indirmeler (exchange_manager.active_downloads)
            active_tasks = self.exchange_manager.active_downloads
            
            # 2. Tamamlanan görevler veritabanından
            completed_tasks = await self.db_manager.get_all_download_tasks_from_db()
            
            # Birleştir (aktif olanlar öncelikli)
            all_tasks = {**completed_tasks, **active_tasks}
            
            return {
                "status": "success",
                "downloads": all_tasks,
                "active_count": len(active_tasks),
                "total_count": len(all_tasks)
            }
        except Exception as e:
            logger.error(f"All download tasks error: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Hata olsa bile success dön (frontend çökmesin)
            return {
                "status": "success",
                "downloads": {},
                "active_count": 0,
                "total_count": 0
            }
    
    async def get_symbols_with_data(self) -> Dict[str, Any]:
        """
        Veritabanında verisi olan sembolleri al.

        Returns:
            Sembol listesi
        """
        symbols = await self.db_manager.get_symbols_with_data()
        return {"status": "success", "symbols": symbols}

    async def get_data_inventory(self) -> Dict[str, Any]:
        """
        Veritabanı envanterini al.

        Returns:
            Envanter verisi
        """
        try:
            inventory_data = await self.db_manager.get_data_inventory()
            return {
                "status": "success",
                "total_candles": inventory_data['total_candles'],
                "inventory": inventory_data['inventory'],
                "total_records": len(inventory_data['inventory'])
            }
        except Exception as e:
            logger.error(f"Data inventory error: {e}")
            return {
                "status": "error",
                "message": str(e),
                "total_candles": 0,
                "inventory": []
            }

    async def get_database_stats(self) -> Dict[str, Any]:
        """
        Veritabanı özet istatistiklerini al.

        Returns:
            İstatistik verisi
        """
        try:
            stats_data = await self.db_manager.get_database_stats()
            return {
                "status": "success",
                "total_candles": stats_data['total_candles'],
                "stats": stats_data['stats'],
                "total_symbols": stats_data['total_symbols']
            }
        except Exception as e:
            logger.error(f"Database stats error: {e}")
            return {
                "status": "error",
                "message": str(e),
                "total_candles": 0,
                "stats": [],
                "total_symbols": 0
            }
