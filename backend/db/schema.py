"""SQLite schema initialization for PharmMatcher unified database."""

from db.connection import get_connection

SCHEMA_VERSION = 1


def init_schema() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            -- Normalizer mappings (compatible with MappingDBManager)
            CREATE TABLE IF NOT EXISTS brands (
                arabic_name TEXT PRIMARY KEY,
                canonical_name TEXT NOT NULL,
                source TEXT DEFAULT 'manual',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tokens (
                arabic_name TEXT PRIMARY KEY,
                english_name TEXT NOT NULL,
                token_type TEXT NOT NULL,
                source TEXT DEFAULT 'manual',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stop_words (
                arabic_word TEXT PRIMARY KEY,
                source TEXT DEFAULT 'manual'
            );

            -- Catalog reference entities
            CREATE TABLE IF NOT EXISTS catalog_brands (
                id TEXT PRIMARY KEY,
                title_en TEXT,
                title_ar TEXT,
                slug TEXT,
                image TEXT,
                raw_json TEXT
            );

            CREATE TABLE IF NOT EXISTS catalog_categories (
                slug TEXT PRIMARY KEY,
                level INTEGER NOT NULL DEFAULT 1,
                title_en TEXT,
                title_ar TEXT,
                parent_slug TEXT,
                raw_json TEXT
            );

            -- Live catalog products (served to matcher/search/export)
            CREATE TABLE IF NOT EXISTS catalog_products (
                id TEXT PRIMARY KEY,
                title_en TEXT,
                title_ar TEXT,
                normalized_name_en TEXT,
                slug TEXT,
                price REAL,
                final_price REAL,
                in_stock INTEGER DEFAULT 1,
                image TEXT,
                description_en TEXT,
                description_ar TEXT,
                unit TEXT,
                code TEXT,
                international_barcode TEXT,
                brand_id TEXT,
                category_l1_slug TEXT,
                category_l2_slug TEXT,
                category_l3_slug TEXT,
                share_link TEXT,
                need_prescription INTEGER DEFAULT 0,
                source TEXT DEFAULT 'chefaa',
                raw_json TEXT,
                normalized_at TEXT,
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_catalog_products_normalized
                ON catalog_products(normalized_name_en);
            CREATE INDEX IF NOT EXISTS idx_catalog_products_code
                ON catalog_products(code);
            CREATE INDEX IF NOT EXISTS idx_catalog_products_barcode
                ON catalog_products(international_barcode);
            CREATE INDEX IF NOT EXISTS idx_catalog_products_slug
                ON catalog_products(slug);

            -- Staging catalog used during pipeline refresh (atomic promote)
            CREATE TABLE IF NOT EXISTS catalog_products_staging (
                id TEXT PRIMARY KEY,
                title_en TEXT,
                title_ar TEXT,
                normalized_name_en TEXT,
                slug TEXT,
                price REAL,
                final_price REAL,
                in_stock INTEGER DEFAULT 1,
                image TEXT,
                description_en TEXT,
                description_ar TEXT,
                unit TEXT,
                code TEXT,
                international_barcode TEXT,
                brand_id TEXT,
                category_l1_slug TEXT,
                category_l2_slug TEXT,
                category_l3_slug TEXT,
                share_link TEXT,
                need_prescription INTEGER DEFAULT 0,
                source TEXT DEFAULT 'chefaa',
                raw_json TEXT,
                normalized_at TEXT,
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_catalog_products_staging_normalized
                ON catalog_products_staging(normalized_name_en);

            -- Catalog refresh pipeline jobs
            CREATE TABLE IF NOT EXISTS catalog_pipeline_jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                current_step TEXT,
                steps_json TEXT,
                crawl_job_id TEXT,
                progress_json TEXT,
                error_msg TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                duration INTEGER
            );
            """
        )
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
            ("schema_version", str(SCHEMA_VERSION)),
        )
