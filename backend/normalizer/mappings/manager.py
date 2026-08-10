import sqlite3
import os
from typing import Dict, List, Tuple

class MappingDBManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            # Prefer unified pharmatcher.db when present
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            unified_db = os.path.join(backend_root, "data", "pharmatcher.db")
            if os.path.exists(unified_db):
                db_path = unified_db
            else:
                current_dir = os.path.dirname(os.path.abspath(__file__))
                db_path = os.path.join(current_dir, "db", "mappings.db")
        
        self.db_path = db_path
        self._initialize_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _initialize_db(self):
        """Create tables if they don't exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # Brands table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS brands (
                    arabic_name TEXT PRIMARY KEY,
                    canonical_name TEXT NOT NULL,
                    source TEXT DEFAULT 'manual',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Tokens table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tokens (
                    arabic_name TEXT PRIMARY KEY,
                    english_name TEXT NOT NULL,
                    token_type TEXT NOT NULL,
                    source TEXT DEFAULT 'manual',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Stop words table (for completeness)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stop_words (
                    arabic_word TEXT PRIMARY KEY,
                    source TEXT DEFAULT 'manual'
                )
            """)
            
            conn.commit()

    def bulk_insert_brands(self, brand_list: List[Tuple[str, str, str]]):
        """brand_list: [(arabic, english, source), ...]"""
        with self._get_connection() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO brands (arabic_name, canonical_name, source) VALUES (?, ?, ?)",
                brand_list
            )
            conn.commit()

    def bulk_insert_tokens(self, token_list: List[Tuple[str, str, str, str]]):
        """token_list: [(arabic, english, type, source), ...]"""
        with self._get_connection() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
                token_list
            )
            conn.commit()

    def bulk_insert_stop_words(self, stop_words: List[Tuple[str, str]]):
        with self._get_connection() as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO stop_words (arabic_word, source) VALUES (?, ?)",
                stop_words
            )
            conn.commit()

    def get_brand_map(self) -> Dict[str, str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT arabic_name, canonical_name FROM brands")
            return dict(cursor.fetchall())

    def get_token_map(self) -> Dict[str, str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT arabic_name, english_name FROM tokens")
            return dict(cursor.fetchall())

    def get_stop_words(self) -> List[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT arabic_word FROM stop_words")
            return [row[0] for row in cursor.fetchall()]

    def add_brand(self, arabic: str, canonical: str, source: str = 'ai'):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO brands (arabic_name, canonical_name, source) VALUES (?, ?, ?)",
                (arabic, canonical, source)
            )
            conn.commit()

    def add_token(self, arabic: str, english: str, token_type: str = 'general', source: str = 'ai'):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
                (arabic, english, token_type, source)
            )
            conn.commit()
