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
                id TEXT PRIMARY KEY, -- UNIQUE trade ID (microsecond hassasiyeti)
                timestamp DATETIME DEFAULT (datetime('now','localtime')),
                closed_at TEXT, -- ISO format (for frontend)
                symbol TEXT NOT NULL,
                strategy_id TEXT, -- Hangi strateji?
                direction TEXT NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL,
                size REAL NOT NULL,
                leverage REAL,  # INTEGER → REAL (1.5x, 2.5x gibi ondalık kaldıraçlar için)
                pnl_usd REAL,
                pnl_percent REAL,
                reason TEXT
                -- bot_id TEXT -- Migration ile eklenecek (backward compatibility)
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

            # Migration: strategy_id column if not exists
            try:
                await self.sqlite_conn.execute("ALTER TABLE trades ADD COLUMN strategy_id TEXT")
                await self.sqlite_conn.execute("ALTER TABLE trades ADD COLUMN closed_at TEXT")
                logger.info("✅ trades tablosuna strategy_id ve closed_at sütunları eklendi (migration).")
            except:
                pass  # Sütun zaten var
            
            # Migration: bot_id column if not exists (yeni duplicate önleme)
            try:
                await self.sqlite_conn.execute("ALTER TABLE trades ADD COLUMN bot_id TEXT")
                logger.info("✅ trades tablosuna bot_id sütunu eklendi (migration).")
            except:
                pass  # Sütun zaten var

            # Migration: leverage INTEGER → REAL (ondalık kaldıraçlar için)
            try:
                await self.sqlite_conn.execute("""
                    CREATE TABLE IF NOT EXISTS trades_new (
                        id TEXT PRIMARY KEY,
                        timestamp DATETIME DEFAULT (datetime('now','localtime')),
                        closed_at TEXT,
                        symbol TEXT NOT NULL,
                        strategy_id TEXT,
                        direction TEXT NOT NULL,
                        entry_price REAL NOT NULL,
                        exit_price REAL,
                        size REAL NOT NULL,
                        leverage REAL,
                        pnl_usd REAL,
                        pnl_percent REAL,
                        reason TEXT,
                        bot_id TEXT
                    )
                """)

                # Eski veriyi yeni tabloya kopyala
                await self.sqlite_conn.execute("""
                    INSERT OR IGNORE INTO trades_new
                    SELECT id, timestamp, closed_at, symbol, strategy_id, direction,
                           entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason, bot_id
                    FROM trades
                """)

                # Eski tabloyu sil ve yeni tabloyu rename et
                await self.sqlite_conn.execute("DROP TABLE IF EXISTS trades")
                await self.sqlite_conn.execute("ALTER TABLE trades_new RENAME TO trades")

                logger.info("✅ trades tablosu leverage REAL olarak güncellendi (migration).")
            except Exception as e:
                logger.debug(f"⚠️ Leverage migration atlandı (tablo zaten güncel olabilir): {e}")
                # Eski tabloyu temizle
                await self.sqlite_conn.execute("DROP TABLE IF EXISTS trades_new")

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
        """
        Veritabanındaki bir sembole ait en eski ve en yeni mum tarihlerini mili saniye (ms) cinsinden döner.
        
        SEMBOL NORMALİZASYONU (FALLBACK MEKANİZMASI):
        1. Önce gelen symbol ile dene
        2. Bulamazsa _future ekle
        3. Bulamazsa / ve : temizle + _future ekle
        4. İlk bulunan pozitif sonucu döner
        """
        # Sembol varyasyonları oluştur (Fallback sırası)
        symbol_variants = [symbol]
        
        if not symbol.endswith('_future'):
            symbol_variants.append(f"{symbol}_future")
        
        # Özel durum: CCXT formatı (BTC/USDT:USDT)
        if ':' in symbol:
            base_part = symbol.split(':')[0]
            clean_base = base_part.replace('/', '').replace('-', '')
            symbol_variants.append(clean_base)
            symbol_variants.append(f"{clean_base}_future")
            
        # Genel temizlik
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').replace('_', '')
        if symbol_clean not in symbol_variants:
            symbol_variants.append(symbol_clean)
            symbol_variants.append(f"{symbol_clean}_future")
            
        # Tekrar edenleri temizle
        seen = set()
        symbol_variants = [x for x in symbol_variants if not (x in seen or seen.add(x))]
        
        sql = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE symbol = ? AND timeframe = ?"
        
        # Her varyasyonu dene
        found_any_tf = []
        for sym_variant in symbol_variants:
            # Önce bu varyantın HERHANGİ bir timeframe'de olup olmadığını kontrol et (Sadece ilk döngüde bir kez yeterli olabilir ama varyant bazlı gitmek daha garanti)
            if not found_any_tf:
                check_sql = "SELECT DISTINCT timeframe FROM klines WHERE symbol = ?"
                if self.engine_type == "postgres":
                    async with self.db_pool.acquire() as conn:
                        tf_rows = await conn.fetch(check_sql.replace('?', '$1'), sym_variant)
                        found_any_tf = [r['timeframe'] for r in tf_rows]
                else:
                    async with self.sqlite_conn.execute(check_sql, (sym_variant,)) as cursor:
                        tf_rows = await cursor.fetchall()
                        found_any_tf = [r[0] for r in tf_rows]

            if self.engine_type == "postgres":
                sql_pg = "SELECT MIN(timestamp) as start_ts, MAX(timestamp) as end_ts FROM klines WHERE symbol = $1 AND timeframe = $2"
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(sql_pg, sym_variant, timeframe)
            else:
                async with self.sqlite_conn.execute(sql, (sym_variant, timeframe)) as cursor:
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

                logger.debug(f"✅ DB Sembol eşleşti (get_candle_range): {symbol} → {sym_variant}")
                return {
                    "start": to_ms(row['start_ts']),
                    "end": to_ms(row['end_ts'])
                }
        
        # Hiçbir varyant bulunamadı
        if found_any_tf:
            logger.warning(f"⚠️ [DB] {symbol} bulundu ancak {timeframe} verisi yok. Mevcut timeframe'ler: {found_any_tf}")
        else:
            logger.debug(f"⚠️ DB'de sembol bulunamadı: {symbol}")
        return None

    async def get_klines(self, symbol: str, timeframe: str = '1m', limit: int = 1000) -> list:
        """
        Veritabanından belirli bir sembol ve timeframe için mum verilerini çeker.
        ML eğitimi için kullanılır - internete ÇIKMAZ!

        SEMBOL NORMALİZASYONU (FALLBACK MEKANİZMASI):
        1. Önce gelen symbol ile dene
        2. Bulamazsa _future ekle (BTC/USDT:USDT → BTC/USDT:USDT_future)
        3. Bulamazsa / ve : temizle + _future ekle (BTCUSDT_future)
        4. İlk bulunan pozitif sonucu döner

        Args:
            symbol: Sembol adı (örn: BTCUSDT, BTC/USDT, BTC/USDT:USDT)
            timeframe: Zaman dilimi (örn: 1m, 15m, 1h)
            limit: Kaç mum çekilecek (varsayılan: 1000)

        Returns:
            list: OHLCV verileri [(timestamp, open, high, low, close, volume), ...]
        """
        # Sembol varyasyonları oluştur (Fallback sırası)
        symbol_variants = [symbol]
        
        if not symbol.endswith('_future'):
            symbol_variants.append(f"{symbol}_future")
        
        # Özel durum: CCXT formatı (BTC/USDT:USDT)
        if ':' in symbol:
            base_part = symbol.split(':')[0] # BTC/USDT
            clean_base = base_part.replace('/', '').replace('-', '') # BTCUSDT
            symbol_variants.append(clean_base)
            symbol_variants.append(f"{clean_base}_future")
            
        # Genel temizlik
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '').replace('_', '')
        if symbol_clean not in symbol_variants:
            symbol_variants.append(symbol_clean)
            symbol_variants.append(f"{symbol_clean}_future")
            
        # Tekrar edenleri temizle ama sırayı koru
        seen = set()
        symbol_variants = [x for x in symbol_variants if not (x in seen or seen.add(x))]

        # Her varyasyonu dene
        for sym_variant in symbol_variants:
            # SQL sorgusu - en son N mumu getir
            sql = """
                SELECT timestamp, open, high, low, close, volume
                FROM klines
                WHERE symbol = ? AND timeframe = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """
            params = (sym_variant, timeframe, limit)

            if self.engine_type == "postgres":
                sql = sql.replace('?', '%s')
                async with self.db_pool.acquire() as conn:
                    rows = await conn.fetch(sql, sym_variant, timeframe, limit)
                    result = [(row['timestamp'], row['open'], row['high'], row['low'], row['close'], row['volume']) for row in rows]
                    if len(result) > 0:
                        logger.debug(f"✅ DB Sembol eşleşti (get_klines): {symbol} → {sym_variant} ({len(result)} mum)")
                        return result
            else:
                async with self.sqlite_conn.execute(sql, params) as cursor:
                    rows = await cursor.fetchall()
                    result = [(row[0], row[1], row[2], row[3], row[4], row[5]) for row in rows]
                    if len(result) > 0:
                        logger.debug(f"✅ DB Sembol eşleşti (get_klines): {symbol} → {sym_variant} ({len(result)} mum)")
                        return result

        # Hiçbir varyant bulunamadı
        return []

    async def get_klines_count(self, symbol: str, timeframe: str = '1m') -> int:
        """
        Veritabanında belirli bir sembol ve timeframe için kaç mum olduğunu döner.
        VALIDATION için kullanılır.

        SEMBOL NORMALİZASYONU (FALLBACK MEKANİZMASI):
        1. Önce gelen symbol ile dene
        2. Bulamazsa _future ekle (BTC/USDT:USDT → BTC/USDT:USDT_future)
        3. Bulamazsa / ve : temizle + _future ekle (BTCUSDT_future)
        4. İlk bulunan pozitif sonucu döner

        Args:
            symbol: Sembol adı (örn: BTCUSDT, BTC/USDT, BTC/USDT:USDT)
            timeframe: Zaman dilimi

        Returns:
            int: Toplam mum sayısı (0 = hiç veri yok)
        """
        # Sembol varyasyonları oluştur (Fallback sırası)
        symbol_variants = [
            symbol,  # 1. Orijinal sembol
            f"{symbol}_future",  # 2. _future ekli
        ]

        # 3. Temizlenmiş + _future (örn: BTCUSDT_future)
        symbol_clean = symbol.replace('/', '').replace(':', '').replace('-', '')
        if symbol_clean != symbol:
            symbol_variants.append(f"{symbol_clean}_future")

        # Her varyasyonu dene
        for sym_variant in symbol_variants:
            sql = "SELECT COUNT(*) as cnt FROM klines WHERE symbol = ? AND timeframe = ?"
            params = (sym_variant, timeframe)

            if self.engine_type == "postgres":
                sql = sql.replace('?', '%s')
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(sql, sym_variant, timeframe)
                    cnt = row['cnt'] if row else 0
                    if cnt > 0:
                        logger.debug(f"✅ DB Sembol eşleşti: {symbol} → {sym_variant} ({cnt} mum)")
                        return cnt
            else:
                async with self.sqlite_conn.execute(sql, params) as cursor:
                    row = await cursor.fetchone()
                    cnt = row[0] if row else 0
                    if cnt > 0:
                        logger.debug(f"✅ DB Sembol eşleşti: {symbol} → {sym_variant} ({cnt} mum)")
                        return cnt

        # Hiçbir varyant bulunamadı
        return 0
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

    async def get_data_inventory(self):
        """
        Veritabanındaki tüm kline verilerinin envanterini çıkarır.
        
        Returns:
            dict: {
                'total_candles': int,
                'inventory': [
                    {
                        'symbol': str,
                        'timeframe': str,
                        'min_timestamp': datetime,
                        'max_timestamp': datetime,
                        'count': int
                    },
                    ...
                ]
            }
        """
        import pandas as pd
        
        sql = """
            SELECT 
                symbol, 
                timeframe, 
                MIN(timestamp) as min_ts, 
                MAX(timestamp) as max_ts, 
                COUNT(*) as candle_count
            FROM klines
            GROUP BY symbol, timeframe
            ORDER BY symbol, timeframe
        """
        
        total_candles = 0
        inventory = []
        
        try:
            if self.engine_type == "sqlite":
                async with self.sqlite_conn.execute(sql) as cursor:
                    rows = await cursor.fetchall()
                    logger.info(f"📊 Envanter sorgusu: {len(rows)} kayıt bulundu")
                    
                    for row in rows:
                        count = row[4] or 0
                        total_candles += count
                        inventory.append({
                            'symbol': row[0],
                            'timeframe': row[1],
                            'min_timestamp': row[2],
                            'max_timestamp': row[3],
                            'count': count
                        })
                    
                    logger.info(f"📊 Toplam mum sayısı: {total_candles}")
            else:
                async with self.db_pool.acquire() as conn:
                    rows = await conn.fetch(sql)
                    for row in rows:
                        count = row['candle_count'] or 0
                        total_candles += count
                        inventory.append({
                            'symbol': row['symbol'],
                            'timeframe': row['timeframe'],
                            'min_timestamp': row['min_ts'],
                            'max_timestamp': row['max_ts'],
                            'count': count
                        })
            
            # Timestamp'leri okunabilir formata çevir
            for item in inventory:
                if item['min_timestamp']:
                    if isinstance(item['min_timestamp'], (int, float)):
                        item['min_date'] = pd.to_datetime(item['min_timestamp'], unit='ms').strftime('%Y-%m-%d %H:%M')
                    elif isinstance(item['min_timestamp'], str):
                        item['min_date'] = item['min_timestamp']
                    else:
                        item['min_date'] = str(item['min_timestamp'])
                else:
                    item['min_date'] = 'N/A'
                    
                if item['max_timestamp']:
                    if isinstance(item['max_timestamp'], (int, float)):
                        item['max_date'] = pd.to_datetime(item['max_timestamp'], unit='ms').strftime('%Y-%m-%d %H:%M')
                    elif isinstance(item['max_timestamp'], str):
                        item['max_date'] = item['max_timestamp']
                    else:
                        item['max_date'] = str(item['max_timestamp'])
                else:
                    item['max_date'] = 'N/A'
            
            return {
                'total_candles': total_candles,
                'inventory': inventory
            }
        except Exception as e:
            logger.error(f"❌ Envanter hatası: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Hata olsa bile boş response dön
            return {
                'total_candles': total_candles,
                'inventory': [],
                'error': str(e)
            }

    async def get_database_stats(self):
        """
        Veritabanı özet istatistiklerini çıkarır.
        
        Returns:
            dict: {
                'total_candles': int,
                'stats': [
                    {
                        'symbol': str,
                        'min_date': str,
                        'max_date': str,
                        'count': int
                    },
                    ...
                ]
            }
        """
        import pandas as pd
        
        # Toplam mum sayısı
        sql_total = "SELECT COUNT(*) as total FROM klines"
        
        # Sembol bazlı istatistikler
        sql_stats = """
            SELECT 
                symbol,
                MIN(timestamp) as min_ts,
                MAX(timestamp) as max_ts,
                COUNT(*) as candle_count
            FROM klines
            GROUP BY symbol
            ORDER BY symbol
        """
        
        total_candles = 0
        stats = []
        
        try:
            if self.engine_type == "sqlite":
                # Toplam mum
                async with self.sqlite_conn.execute(sql_total) as cursor:
                    row = await cursor.fetchone()
                    total_candles = row[0] if row else 0
                
                # Sembol istatistikleri
                async with self.sqlite_conn.execute(sql_stats) as cursor:
                    rows = await cursor.fetchall()
                    for row in rows:
                        stats.append({
                            'symbol': row[0],
                            'min_timestamp': row[1],
                            'max_timestamp': row[2],
                            'count': row[3] or 0
                        })
            else:
                async with self.db_pool.acquire() as conn:
                    row = await conn.fetchrow(sql_total)
                    total_candles = row['total'] if row else 0
                    
                    rows = await conn.fetch(sql_stats)
                    for row in rows:
                        stats.append({
                            'symbol': row['symbol'],
                            'min_timestamp': row['min_ts'],
                            'max_timestamp': row['max_ts'],
                            'count': row['candle_count'] or 0
                        })
            
            # Timestamp'leri okunabilir formata çevir
            for item in stats:
                if item['min_timestamp']:
                    if isinstance(item['min_timestamp'], (int, float)):
                        item['min_date'] = pd.to_datetime(item['min_timestamp'], unit='ms').strftime('%Y-%m-%d')
                    else:
                        item['min_date'] = str(item['min_timestamp'])
                else:
                    item['min_date'] = 'N/A'
                    
                if item['max_timestamp']:
                    if isinstance(item['max_timestamp'], (int, float)):
                        item['max_date'] = pd.to_datetime(item['max_timestamp'], unit='ms').strftime('%Y-%m-%d')
                    else:
                        item['max_date'] = str(item['max_timestamp'])
                else:
                    item['max_date'] = 'N/A'
            
            return {
                'total_candles': total_candles,
                'stats': stats,
                'total_symbols': len(stats)
            }
        except Exception as e:
            logger.error(f"❌ Database stats hatası: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                'total_candles': 0,
                'stats': [],
                'total_symbols': 0,
                'error': str(e)
            }
    async def save_trade(self, trade_info: dict):
        """Kapatılan bir işlemi kalıcı hafızaya yazar (UNIQUE ID ile duplicate önleme)."""
        # bot_id kolonu eski DB'lerde olmayabilir, opsiyonel yap
        sql = """
            INSERT OR IGNORE INTO trades (id, symbol, strategy_id, direction, entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason, closed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = (
            trade_info.get('id'),  # UNIQUE ID (microsecond)
            trade_info['symbol'], 
            trade_info.get('strategy_id'), 
            trade_info['direction'], 
            trade_info['entry_price'],
            trade_info.get('exit_price'), 
            trade_info['size'], 
            trade_info['leverage'],
            trade_info.get('pnl_usd'), 
            trade_info.get('pnl_percent'), 
            trade_info.get('reason'),
            trade_info.get('closed_at')
            # bot_id EKLENMEDİ - eski DB'lerde kolon yok!
        )

        try:
            if self.engine_type == "postgres":
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO trades (id, symbol, strategy_id, direction, entry_price, exit_price, size, leverage, pnl_usd, pnl_percent, reason, closed_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                        ON CONFLICT (id) DO NOTHING
                    """, *params)
            else:
                await self.sqlite_conn.execute(sql, params)
                await self.sqlite_conn.commit()

            logger.info(f"✅ İşlem Hafızaya ({self.engine_type}) Kaydedildi: {trade_info['symbol']} | PnL: {trade_info.get('pnl_usd', 0):.2f}")
        except Exception as e:
            logger.error(f"❌ İşlem kaydedilirken hata oluştu ({trade_info['symbol']}): {e}")
            import traceback
            logger.error(traceback.format_exc())


    async def get_trades_by_strategy(self, strategy_id: str, limit=100):
        """Belirli bir stratejiye ait son tamamlanmış işlemleri getirir."""
        sql = "SELECT * FROM trades WHERE strategy_id = ? ORDER BY closed_at DESC LIMIT ?"
        if self.engine_type == "postgres":
            sql = "SELECT * FROM trades WHERE strategy_id = $1 ORDER BY closed_at DESC LIMIT $2"
            async with self.db_pool.acquire() as conn:
                return [dict(row) for row in await conn.fetch(sql, strategy_id, limit)]
        else:
            async with self.sqlite_conn.execute(sql, (strategy_id, limit)) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def get_recent_trades(self, limit=50):
        """Veritabanındaki son tamamlanmış işlemleri getirir."""
        sql = "SELECT * FROM trades ORDER BY closed_at DESC LIMIT ?"
        if self.engine_type == "postgres":
            sql = "SELECT * FROM trades ORDER BY closed_at DESC LIMIT $1"
            async with self.db_pool.acquire() as conn:
                return [dict(row) for row in await conn.fetch(sql, limit)]
        else:
            async with self.sqlite_conn.execute(sql, (limit,)) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def clear_trade_history(self):
        """Tüm işlem geçmişini temizler."""
        sql = "DELETE FROM trades"
        if self.engine_type == "postgres":
            async with self.db_pool.acquire() as conn:
                await conn.execute(sql)
        else:
            await self.sqlite_conn.execute(sql)
            await self.sqlite_conn.commit()
        logger.info("🗑️ Tüm işlem geçmişi temizlendi.")

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

    async def get_all_download_tasks_from_db(self) -> dict:
        """
        Veritabanındaki tüm indirme görevlerini dict formatında döner.
        Key: {symbol}_{market_type}, Value: task info
        
        Returns:
            dict: {symbol_market: task_info, ...}
        """
        try:
            tasks = await self.get_all_download_tasks()
            result = {}
            
            for task in tasks:
                symbol = task.get('symbol', '')
                market_type = task.get('market_type', 'future')
                key = f"{symbol}_{market_type}"
                
                # Tamamlanmış görevler için progress %100
                status = task.get('status', 'completed')
                progress = 100 if status == 'completed' else task.get('progress', 0)
                
                result[key] = {
                    **task,
                    'progress': progress,
                    'source': 'database'  # DB'den geldiğini işaretle
                }
            
            return result
        except Exception as e:
            logger.error(f"get_all_download_tasks_from_db error: {e}")
            return {}

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
