"""Normalizer mappings stored in the unified pharmatcher.db."""

from __future__ import annotations

from typing import Dict, List, Tuple

from db.connection import get_connection
from db.schema import init_schema


def ensure_mappings_schema() -> None:
    init_schema()


def bulk_insert_brands(brand_list: List[Tuple[str, str, str]]) -> None:
    with get_connection() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO brands (arabic_name, canonical_name, source) VALUES (?, ?, ?)",
            brand_list,
        )


def bulk_insert_tokens(token_list: List[Tuple[str, str, str, str]]) -> None:
    with get_connection() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO tokens (arabic_name, english_name, token_type, source) VALUES (?, ?, ?, ?)",
            token_list,
        )


def bulk_insert_stop_words(stop_words: List[Tuple[str, str]]) -> None:
    with get_connection() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO stop_words (arabic_word, source) VALUES (?, ?)",
            stop_words,
        )


def get_brand_map() -> Dict[str, str]:
    with get_connection() as conn:
        cur = conn.execute("SELECT arabic_name, canonical_name FROM brands")
        return dict(cur.fetchall())


def get_token_map() -> Dict[str, str]:
    with get_connection() as conn:
        cur = conn.execute("SELECT arabic_name, english_name FROM tokens")
        return dict(cur.fetchall())


def get_stop_words() -> List[str]:
    with get_connection() as conn:
        cur = conn.execute("SELECT arabic_word FROM stop_words")
        return [row[0] for row in cur.fetchall()]
