import asyncio
import aiosqlite
import asyncpg
import os
from core.logger import logger
from core.config import TIMESCALE_DB_URL, REDIS_URL

class DatabaseManager:
    """Modüler Veritabanı Yöneticisi: 
    PostgreSQL (Docker/Sunucu) varsa ona bağlanır, yoksa yerel SQLite (Dosya) kullanır."""
    
    def __init__(self):
        self.db_pool = None      # PostgreSQL için
        self.sqlite_conn = None  # SQLite için
        self.engine_type = "sqlite" # Varsayılan
        self.sqlite_path = "cryptobot.db"

    async def connect(self):
        """Kalıcı veritabanı bağlantılarını başlatır."""
        try:
            # 1. PostgreSQL/TimescaleDB Önceliği
            if TIMESCALE_DB_URL:
                try:
                    self.db_pool = await asyncpg.create_pool(dsn=TIMESCALE_DB_URL, min_size=2, max_size=10)
                    self.engine_type = "postgres"
                    logger.info("Aşama 1.5: Kalıcı Veritabanı (PostgreSQL) bağlantı havuzu oluşturuldu.")
                except Exception as pg_err:
                    logger.warning(f"PostgreSQL bağlantısı başarısız, SQLite'a geçiliyor: {pg_err}")
            
            # 2. SQLite Fallback (Docker/Postgres yoksa devreye girer)
            if self.engine_type == "sqlite":
                self.sqlite_conn = await aiosqlite.connect(self.sqlite_path)
                self.sqlite_conn.row_factory = aiosqlite.Row
                logger.info(f"Aşama 1.5: Docker Gerektirmeyen Yerel Hafıza (SQLite) aktif -> {self.sqlite_path}")

            # Tabloları ayağa kaldır
            await self.initialize_db()

        except Exception as e:
            logger.error(f"Veritabanı Başlatma Hatası: {e}")

    async def initialize_db(self):
        """Gerekli tabloları oluşturur (Hem PG hem SQLite uyumlu SQL)."""
        # Mum Verileri
        kline_sql = """
            CREATE TABLE IF NOT EXISTS klines (
                timestamp TIMESTAMP NOT NULL,
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL DEFAULT '1m',
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL,
                PRIMARY KEY (timestamp, symbol, timeframe)
            );
        """
        # İndirme Görevleri (Persistent Tasks)
        tasks_sql = """
            CREATE TABLE IF NOT EXISTS download_tasks (
                symbol TEXT PRIMARY KEY,
                timeframe TEXT NOT NULL,
                start_date TEXT NOT NULL,
                market_type TEXT NOT NULL,
                status TEXT NOT NULL,
                current_ts BIGINT,
                target_start_ms BIGINT
            );
        """
        # İşlem Geçmişi
        trades_sql = """
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT (datetime('now','localtime')),
                symbol TEXT NOT NULL,
                direction TEXT NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL,
                size REAL NOT NULL,
                leverage INTEGER,
                pnl_usd REAL,
                pnl_percent REAL,
                reason TEXT
            );
        """
        # Postgres için trade tablosu SERIAL farklılığı
        if self.engine_type == "postgres":
            trades_sql = trades_sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            trades_sql = trades_sql.replace("DATETIME DEFAULT (datetime('now','localtime'))", "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP")

        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute(kline_sql)
                await conn.execute(tasks_sql)
                await conn.execute(trades_sql)
        else:
            await self.sqlite_conn.execute(kline_sql)
            await self.sqlite_conn.execute(tasks_sql)
            await self.sqlite_conn.execute(trades_sql)
            await self.sqlite_conn.commit()
            
        logger.info(f"Veritabanı şeması ({self.engine_type}) doğrulandı.")

    async def save_kline(self, symbol, kline_data, timeframe='1m'):
        """Veriyi UPSERT (Varsa güncelle yoksa ekle) yöntemiyle kaydeder."""
        # kline_data: [ts, o, h, l, c, v]
        ts_iso = pd.to_datetime(kline_data[0], unit='ms').to_pydatetime() if self.engine_type == "sqlite" else kline_data[0]
        
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO klines (timestamp, symbol, timeframe, open, high, low, close, volume)
                    VALUES (to_timestamp($1/1000.0), $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (timestamp, symbol, timeframe) DO UPDATE SET
                        open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume;
                """, kline_data[0], symbol, timeframe, kline_data[1], kline_data[2], kline_data[3], kline_data[4], kline_data[5])
        else:
            # SQLite Kaydı
            await self.sqlite_conn.execute("""
                INSERT INTO klines (timestamp, symbol, timeframe, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (timestamp, symbol, timeframe) DO UPDATE SET
                    open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume;
            """, (ts_iso, symbol, timeframe, kline_data[1], kline_data[2], kline_data[3], kline_data[4], kline_data[5]))
            await self.sqlite_conn.commit()

    async def get_candle_range(self, symbol, timeframe='1m'):
        """Veritabanındaki bir sembole ait en eski ve en yeni mum tarihlerini mili saniye (ms) cinsinden döner."""
        sql = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE symbol = ? AND timeframe = ?"
        if self.engine_type == "postgres":
            sql = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE symbol = $1 AND timeframe = $2"
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(sql, symbol, timeframe)
        else:
            async with self.sqlite_conn.execute(sql, (symbol, timeframe)) as cursor:
                row = await cursor.fetchone()
        
        if row and row['start_ts']:
            # SQLite'da string/datetime dönebilir, asanp/postgres'de datetime. Unix timestamp (ms) çevirelim.
            import datetime
            def to_ms(val):
                if isinstance(val, str): val = pd.to_datetime(val).to_pydatetime()
                return int(val.timestamp() * 1000)
            
            return {
                "start": to_ms(row['start_ts']),
                "end": to_ms(row['end_ts'])
            }
    async def get_symbols_with_data(self):
        """Veritabanında (klines tablosunda) en az 1 kaydı bulunan tüm pariteleri getirir."""
        sql = "SELECT DISTINCT symbol FROM klines"
        symbols = []
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(sql)
                symbols = [row['symbol'] for row in rows]
        else:
            async with self.sqlite_conn.execute(sql) as cursor:
                rows = await cursor.fetchall()
                symbols = [row[0] for row in rows]
                
        # Manuel temizlik: 'BTC/USDT' ve 'BTC/USDT:USDT' gibi çakışmaları temizle
        clean_symbols = set()
        for s in symbols:
            # Sadece ana parite ismini al (Örn: OG/USDT:USDT -> OG/USDT)
            base = s.split(':')[0].strip()
            clean_symbols.add(base)
            
        return sorted(list(clean_symbols))
    async def save_trade(self, trade_info: dict):
        """Kapatılan bir işlemi kalıcı hafızaya yazar."""
        sql = """
            INSERT INTO trades (symbol, direction, entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (trade_info['symbol'], trade_info['direction'], trade_info['entry_price'], 
                  trade_info.get('exit_price'), trade_info['size'], trade_info['leverage'],
                  trade_info.get('pnl_usd'), trade_info.get('pnl_percent'), trade_info.get('reason'))

        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO trades (symbol, direction, entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, *params)
        else:
            await self.sqlite_conn.execute(sql, params)
            await self.sqlite_conn.commit()
            
        logger.info(f"İşlem Hafızaya ({self.engine_type}) Kaydedildi: {trade_info['symbol']}")

    async def get_recent_trades(self, limit=50):
        """Veritabanındaki son tamamlanmış işlemleri getirir."""
        sql = "SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?"
        if self.engine_type == "postgres":
            sql = "SELECT * FROM trades ORDER BY timestamp DESC LIMIT $1"
            async with self.db_pool.acquire() as conn:
                return [dict(row) for row in await conn.fetch(sql, limit)]
        else:
            async with self.sqlite_conn.execute(sql, (limit,)) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def save_download_task(self, task: dict):
        """İndirme görevini veritabanına kaydeder veya günceller."""
        sql = """
            INSERT INTO download_tasks (symbol, timeframe, start_date, market_type, status, current_ts, target_start_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                status=excluded.status, current_ts=excluded.current_ts;
        """
        params = (task['symbol'], task['timeframe'], task['start_date'], task['market_type'], 
                  task['status'], task.get('current_ts'), task['target_start_ms'])
        
        if self.engine_type == "postgres":
            sql = sql.replace("?", "$").replace("excluded", "EXCLUDED") # Basitleştirilmiş PG uyumu gerekebilir
            # PG için tam query:
            pg_sql = """
                INSERT INTO download_tasks (symbol, timeframe, start_date, market_type, status, current_ts, target_start_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT(symbol) DO UPDATE SET
                    status=EXCLUDED.status, current_ts=EXCLUDED.current_ts;
            """
            async with self.db_pool.acquire() as conn:
                await conn.execute(pg_sql, *params)
        else:
            await self.sqlite_conn.execute(sql, params)
            await self.sqlite_conn.commit()

    async def get_all_download_tasks(self):
        """Kayıtlı tüm indirme görevlerini döner."""
        sql = "SELECT * FROM download_tasks"
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                return [dict(row) for row in await conn.fetch(sql)]
        else:
            async with self.sqlite_conn.execute(sql) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def delete_download_task(self, symbol: str):
        """Görevi veritabanından siler (Tamamlandığında veya kalıcı iptalde)."""
        sql = "DELETE FROM download_tasks WHERE symbol = ?"
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute("DELETE FROM download_tasks WHERE symbol = $1", symbol)
        else:
            await self.sqlite_conn.execute(sql, (symbol,))
            await self.sqlite_conn.commit()

    async def delete_klines_for_symbol(self, symbol: str):
        """Belirli bir sembole ait tüm indirilmiş mum verilerini siler."""
        sql = "DELETE FROM klines WHERE symbol = ?"
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute("DELETE FROM klines WHERE symbol = $1", symbol)
        else:
            await self.sqlite_conn.execute(sql, (symbol,))
            await self.sqlite_conn.commit()

    async def close(self):
        """Bağlantıları temizce kapatır."""
        if self.db_pool: await self.db_pool.close()
        if self.sqlite_conn: await self.sqlite_conn.close()
        logger.info("Veritabanı bağlantıları sonlandırıldı.")

# Gereken Pandas importu (fonksiyon içinde)
import pandas as pd
db_manager = DatabaseManager()
