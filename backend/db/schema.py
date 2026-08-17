"""SQLite schema initialization for PharmMatcher unified database."""

from db.connection import get_connection
from db.migrate_legacy_job_dbs import migrate_legacy_job_databases

SCHEMA_VERSION = 3


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

            -- User-configured product discovery sources (one row per domain)
            CREATE TABLE IF NOT EXISTS source_profiles (
                domain TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                platform TEXT NOT NULL DEFAULT 'custom',
                enabled INTEGER DEFAULT 1,
                priority INTEGER DEFAULT 100,
                search_config_json TEXT,
                extract_config_json TEXT,
                sample_url TEXT,
                created_by TEXT,
                last_tested_at TEXT,
                last_test_status TEXT,
                raw_json TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_source_profiles_priority
                ON source_profiles(priority);

            -- Match Sheet job history
            CREATE TABLE IF NOT EXISTS matcher_jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                pid INTEGER,
                filename TEXT NOT NULL,
                total_rows INTEGER DEFAULT 0,
                processed_rows INTEGER DEFAULT 0,
                matched_count INTEGER DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                no_match_count INTEGER DEFAULT 0,
                column_used TEXT,
                match_threshold REAL,
                review_threshold REAL,
                output_path TEXT,
                results_path TEXT,
                error_msg TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                duration INTEGER,
                use_uploaded_price INTEGER DEFAULT 0,
                price_column TEXT,
                use_uploaded_stock INTEGER DEFAULT 0,
                stock_column TEXT,
                default_stock INTEGER DEFAULT 10,
                use_uploaded_code INTEGER DEFAULT 0,
                code_column TEXT,
                use_uploaded_international_barcode INTEGER DEFAULT 0,
                international_barcode_column TEXT,
                match_with_international_barcode INTEGER DEFAULT 0,
                match_international_barcode_column TEXT,
                match_with_code INTEGER DEFAULT 0,
                match_pos_code_column TEXT,
                skip_normalizer INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS matcher_job_results (
                job_id TEXT PRIMARY KEY,
                results_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES matcher_jobs(job_id) ON DELETE CASCADE
            );

            -- Product Discovery job history
            CREATE TABLE IF NOT EXISTS discovery_jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                pid INTEGER,
                filename TEXT NOT NULL,
                input_type TEXT NOT NULL,
                matcher_job_id TEXT,
                name_column TEXT,
                source_domains_json TEXT,
                total_rows INTEGER DEFAULT 0,
                processed_rows INTEGER DEFAULT 0,
                found_count INTEGER DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                not_found_count INTEGER DEFAULT 0,
                imported_count INTEGER DEFAULT 0,
                match_threshold REAL,
                review_threshold REAL,
                results_path TEXT,
                error_msg TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                duration INTEGER
            );

            CREATE TABLE IF NOT EXISTS discovery_job_results (
                job_id TEXT PRIMARY KEY,
                results_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES discovery_jobs(job_id) ON DELETE CASCADE
            );

            -- Barcode Enrichment job history
            CREATE TABLE IF NOT EXISTS enrichment_jobs (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                pid INTEGER,
                filename TEXT NOT NULL,
                total_rows INTEGER DEFAULT 0,
                processed_rows INTEGER DEFAULT 0,
                matched_count INTEGER DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                no_match_count INTEGER DEFAULT 0,
                already_synced_count INTEGER DEFAULT 0,
                applied_count INTEGER DEFAULT 0,
                pending_apply_count INTEGER DEFAULT 0,
                name_column TEXT,
                barcode_column TEXT,
                code_column TEXT,
                match_threshold REAL,
                review_threshold REAL,
                results_path TEXT,
                error_msg TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                finished_at TEXT,
                duration INTEGER
            );

            CREATE TABLE IF NOT EXISTS enrichment_job_results (
                job_id TEXT PRIMARY KEY,
                results_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES enrichment_jobs(job_id) ON DELETE CASCADE
            );
            """
        )
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
            ("schema_version", str(SCHEMA_VERSION)),
        )
        _seed_chefaa_source_profile(conn)

    migrate_legacy_job_databases()


def _seed_chefaa_source_profile(conn) -> None:
    """Ensure built-in Chefaa Meilisearch source exists."""
    import json

    row = conn.execute(
        "SELECT domain FROM source_profiles WHERE domain = ?",
        ("chefaa.com",),
    ).fetchone()
    if row:
        return
    conn.execute(
        """
        INSERT INTO source_profiles (
            domain, display_name, platform, enabled, priority,
            search_config_json, extract_config_json, sample_url, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "chefaa.com",
            "Chefaa",
            "chefaa",
            1,
            0,
            json.dumps({"type": "meilisearch", "country": "eg"}),
            json.dumps({}),
            "https://chefaa.com",
            "system",
        ),
    )
