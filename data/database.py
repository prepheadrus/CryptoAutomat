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
        self._lock = asyncio.Lock()  # Database lock mekanizması

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
                self.sqlite_conn = await aiosqlite.connect(
                    self.sqlite_path,
                    timeout=60.0,  # 60 saniye timeout (locked hatası için)
                    isolation_level=None  # WAL mode için gerekli
                )
                self.sqlite_conn.row_factory = aiosqlite.Row

                # SQLite optimizasyonları (Database locked önleme)
                await self.sqlite_conn.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging
                await self.sqlite_conn.execute("PRAGMA busy_timeout=60000")  # 60 saniye bekle
                await self.sqlite_conn.execute("PRAGMA synchronous=NORMAL")  # Daha hızlı yazma
                await self.sqlite_conn.execute("PRAGMA cache_size=10000")  # 10MB cache

                logger.info(f"Aşama 1.5: Docker Gerektirmeyen Yerel Hafıza (SQLite) aktif -> {self.sqlite_path}")
                logger.info("SQLite optimizasyonları aktif: WAL mode, 60s timeout, busy_timeout=60000")

            # Tabloları ayağa kaldır
            await self.initialize_db()

        except Exception as e:
            logger.error(f"Veritabanı Başlatma Hatası: {e}")

    async def initialize_db(self):
        """Gerekli tabloları oluşturur ve şema hatalarını otomatik düzeltir."""
        # 1. Önce şema doğrulama ve migration (Cross-platform uyumluluk için kritik)
        await self._validate_and_migrate_schemas()

        # 2. Standart tabloları oluştur
        await self._create_standard_tables()

        logger.info(f"Veritabanı şeması ({self.engine_type}) doğrulandı.")

    async def _validate_and_migrate_schemas(self):
        """Veritabanı şemalarını doğrular ve gerekirse otomatik düzeltir."""
        if self.engine_type == "sqlite":
            # download_tasks tablosunu kontrol et
            await self._validate_download_tasks_schema()

    async def _validate_download_tasks_schema(self):
        """download_tasks tablosunun PRIMARY KEY şemasını doğrular ve düzeltir."""
        try:
            async with self.sqlite_conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='download_tasks'"
            ) as cursor:
                result = await cursor.fetchone()

                if result:
                    schema = result[0]
                    # PRIMARY KEY (symbol, market_type) var mı kontrol et
                    has_correct_pk = (
                        "PRIMARY KEY" in schema.upper() and
                        "symbol" in schema.lower() and
                        "market_type" in schema.lower()
                    )

                    if not has_correct_pk:
                        logger.warning("⚠️ download_tasks şeması hatalı, otomatik düzeltiliyor...")
                        await self._migrate_download_tasks_schema()
                # Tablo yoksa, _create_standard_tables oluşturacak

        except Exception as e:
            logger.error(f"download_tasks şema doğrulama hatası: {e}")

    async def _migrate_download_tasks_schema(self):
        """download_tasks tablosunu doğru şema ile yeniden oluşturur, verileri korur."""
        try:
            # Mevcut verileri yedekle
            async with self.sqlite_conn.execute("SELECT * FROM download_tasks") as cursor:
                rows = await cursor.fetchall()
                saved_data = []
                if rows:
                    columns = [d[0] for d in cursor.description]
                    saved_data = [dict(zip(columns, row)) for row in rows]

            logger.info(f"📦 {len(saved_data)} indirme görevi yedeklendi.")

            # Eski tabloyu sil
            await self.sqlite_conn.execute("DROP TABLE IF EXISTS download_tasks")

            # Yeni doğru şema ile oluştur
            await self.sqlite_conn.execute("""
                CREATE TABLE download_tasks (
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    market_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_ts BIGINT,
                    target_start_ms BIGINT,
                    PRIMARY KEY (symbol, market_type)
                )
            """)

            # Verileri geri yükle
            if saved_data:
                for row in saved_data:
                    await self.sqlite_conn.execute("""
                        INSERT OR REPLACE INTO download_tasks
                        (symbol, timeframe, start_date, market_type, status, current_ts, target_start_ms)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        row.get('symbol'), row.get('timeframe'), row.get('start_date'),
                        row.get('market_type'), row.get('status'),
                        row.get('current_ts'), row.get('target_start_ms')
                    ))

            await self.sqlite_conn.commit()
            logger.info("✅ download_tasks şeması düzeltildi ve veriler korundu!")

        except Exception as e:
            logger.error(f"download_tasks migration hatası: {e}")
            # Hata durumunda tabloyu yeniden oluştur (verisiz)
            await self.sqlite_conn.execute("DROP TABLE IF EXISTS download_tasks")
            await self.sqlite_conn.execute("""
                CREATE TABLE download_tasks (
                    symbol TEXT NOT NULL,
                    timeframe TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    market_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    current_ts BIGINT,
                    target_start_ms BIGINT,
                    PRIMARY KEY (symbol, market_type)
                )
            """)
            await self.sqlite_conn.commit()

    async def _create_standard_tables(self):
        """Standart veritabanı tablolarını oluşturur."""
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
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                start_date TEXT NOT NULL,
                market_type TEXT NOT NULL,
                status TEXT NOT NULL,
                current_ts BIGINT,
                target_start_ms BIGINT,
                PRIMARY KEY (symbol, market_type)
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

    async def _execute_with_lock(self, func, *args, **kwargs):
        """Database işlemlerini lock ile serialize eder (concurrent access önleme)."""
        async with self._lock:
            return await func(*args, **kwargs)

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
            # SQLite Kaydı - LOCK İLE
            await self._execute_with_lock(
                self.sqlite_conn.execute,
                """
                INSERT INTO klines (timestamp, symbol, timeframe, open, high, low, close, volume)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (timestamp, symbol, timeframe) DO UPDATE SET
                    open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume;
            """, (ts_iso, symbol, timeframe, kline_data[1], kline_data[2], kline_data[3], kline_data[4], kline_data[5])
            )
            await self.sqlite_conn.commit()

    async def get_candle_range(self, symbol, timeframe='1m'):
        """Veritabanındaki bir sembole ait en eski ve en yeni mum tarihlerini mili saniye (ms) cinsinden döner."""
        sql = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE (symbol = ? OR symbol LIKE ?) AND timeframe = ?"
        pattern = f"{symbol}:%"
        if self.engine_type == "postgres":
            sql = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE (symbol = $1 OR symbol LIKE $2) AND timeframe = $3"
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(sql, symbol, pattern, timeframe)
        else:
            async with self.sqlite_conn.execute(sql, (symbol, pattern, timeframe)) as cursor:
                row = await cursor.fetchone()

        if row and row['start_ts']:
            # SQLite'da string/datetime dönebilir, asanp/postgres'de datetime. Unix timestamp (ms) çevirelim.
            import datetime
            def to_ms(val):
                if isinstance(val, str):
                    # SQLite'dan gelen string'i UTC olarak oku
                    dt = pd.to_datetime(val)
                    if dt.tzinfo is None: dt = dt.tz_localize('UTC')
                    else: dt = dt.tz_convert('UTC')
                    return int(dt.timestamp() * 1000)
                # Datetime ise
                if val.tzinfo is None: val = val.replace(tzinfo=datetime.timezone.utc)
                return int(val.timestamp() * 1000)

            return {
                "start": to_ms(row['start_ts']),
                "end": to_ms(row['end_ts'])
            }

    async def get_klines(self, symbol: str, timeframe: str = '1m', limit: int = 1000) -> list:
        """
        Veritabanından belirli bir sembol ve timeframe için mum verilerini çeker.
        ML eğitimi için kullanılır - internete ÇIKMAZ!

        Args:
            symbol: Sembol adı (örn: BTCUSDT, BTC/USDT, BTC/USDT:USDT)
            timeframe: Zaman dilimi (örn: 1m, 15m, 1h)
            limit: Kaç mum çekilecek (varsayılan: 1000)

        Returns:
            list: OHLCV verileri [(timestamp, open, high, low, close, volume), ...]
        """
        # Sembol temizleme - tüm formatları kabul et
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').upper()

        # Esnek pattern - hem spot hem futures formatlarını yakala
        pattern = f"%{symbol_clean}%"

        # SQL sorgusu - en son N mumu getir
        sql = """
            SELECT timestamp, open, high, low, close, volume
            FROM klines
            WHERE (symbol = ? OR symbol LIKE ?)
              AND timeframe = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """
        params = (symbol_clean, pattern, timeframe, limit)

        if self.engine_type == "postgres":
            sql = sql.replace('?', '%s')
            async with self.db_pool.acquire() as conn:
                rows = await conn.fetch(sql, symbol_clean, pattern, timeframe, limit)
                return [(row['timestamp'], row['open'], row['high'], row['low'], row['close'], row['volume']) for row in rows]
        else:
            async with self.sqlite_conn.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
                return [(row[0], row[1], row[2], row[3], row[4], row[5]) for row in rows]

    async def get_klines_count(self, symbol: str, timeframe: str = '1m') -> int:
        """
        Veritabanında belirli bir sembol ve timeframe için kaç mum olduğunu döner.
        Validation için kullanılır.

        Args:
            symbol: Sembol adı (örn: BTCUSDT, BTC/USDT, BTC/USDT:USDT)
            timeframe: Zaman dilimi

        Returns:
            int: Toplam mum sayısı
        """
        # Sembol temizleme - tüm formatları kabul et
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').upper()

        # Esnek pattern - hem spot hem futures formatlarını yakala
        # BNBUSDTUSDT → %BNBUSDTUSDT% (herhangi bir yerde geçerse yakala)
        pattern = f"%{symbol_clean}%"

        sql = "SELECT COUNT(*) as cnt FROM klines WHERE (symbol = ? OR symbol LIKE ?) AND timeframe = ?"
        params = (symbol_clean, pattern, timeframe)

        if self.engine_type == "postgres":
            sql = sql.replace('?', '%s')
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(sql, symbol_clean, pattern, timeframe)
                return row['cnt'] if row else 0
        else:
            async with self.sqlite_conn.execute(sql, params) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0
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
                
        return sorted(symbols)
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
            ON CONFLICT(symbol, market_type) DO UPDATE SET
                status=excluded.status, current_ts=excluded.current_ts;
        """
        params = (task['symbol'], task['timeframe'], task['start_date'], task['market_type'],
                  task['status'], task.get('current_ts'), task['target_start_ms'])

        if self.engine_type == "postgres":
            pg_sql = """
                INSERT INTO download_tasks (symbol, timeframe, start_date, market_type, status, current_ts, target_start_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT(symbol, market_type) DO UPDATE SET
                    status=EXCLUDED.status, current_ts=EXCLUDED.current_ts;
            """
            async with self.db_pool.acquire() as conn:
                await conn.execute(pg_sql, *params)
        else:
            # SQLite - LOCK İLE
            await self._execute_with_lock(
                self.sqlite_conn.execute,
                sql, params
            )
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

    async def delete_download_task(self, symbol: str, market_type: str):
        """Görevi veritabanından SADECE sembol ve market tipine göre hassas şekilde siler."""
        sql = "DELETE FROM download_tasks WHERE symbol = ? AND market_type = ?"
        params = (symbol, market_type)
        pg_sql = "DELETE FROM download_tasks WHERE symbol = $1 AND market_type = $2"
            
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute(pg_sql, *params)
        else:
            await self.sqlite_conn.execute(sql, params)
            await self.sqlite_conn.commit()

    async def delete_klines_for_symbol(self, symbol: str):
        """Belirli bir sembole ait tüm indirilmiş mum verilerini siler (Varyasyonlar dahil)."""
        # Hem tam eşleşenleri hem de 'BTC/USDT:USDT' gibi varyasyonları silmek için
        sql = "DELETE FROM klines WHERE symbol = ? OR symbol LIKE ?"
        pattern = f"{symbol}:%"
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute("DELETE FROM klines WHERE symbol = $1 OR symbol LIKE $2", symbol, pattern)
        else:
            await self.sqlite_conn.execute(sql, (symbol, pattern))
            await self.sqlite_conn.commit()

    async def close(self):
        """Bağlantıları temizce kapatır ve WAL checkpoint yapar."""
        if self.db_pool:
            await self.db_pool.close()
        if self.sqlite_conn:
            # WAL modunda checkpoint yap (journal dosyalarını temizle)
            try:
                await self.sqlite_conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                logger.info("SQLite WAL checkpoint tamamlandı.")
            except Exception as e:
                logger.warning(f"WAL checkpoint hatası: {e}")

            # Bağlantıyı kapat
            await self.sqlite_conn.close()
            logger.info("Veritabanı bağlantıları sonlandırıldı.")

# Gereken Pandas importu (fonksiyon içinde)
import pandas as pd
db_manager = DatabaseManager()
