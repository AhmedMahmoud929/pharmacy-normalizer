"""Catalog repository — all product CRUD goes through SQLite."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from db.connection import get_connection
from db.exceptions import PipelineCancelled


def _now_iso() -> str:
    return datetime.now().isoformat()


def _extract_brand_id(product: Dict[str, Any]) -> Optional[str]:
    brands = product.get("brands")
    if not brands:
        return None
    if isinstance(brands, dict):
        return str(brands.get("id") or brands.get("slug") or "")
    return None


def _extract_category_slug(product: Dict[str, Any], level: int) -> Optional[str]:
    key = {1: "level_one_category", 2: "level_two_category", 3: "level_three_category"}.get(level)
    if not key:
        return None
    cat = product.get(key)
    if isinstance(cat, dict):
        return cat.get("slug")
    return None


def product_record_to_row(product: Dict[str, Any], *, normalized_name: Optional[str] = None) -> Dict[str, Any]:
    """Map a Chefaa / legacy crawler product dict to a catalog row."""
    brand_id = _extract_brand_id(product)
    return {
        "id": str(product.get("id") or product.get("slug") or ""),
        "title_en": product.get("title_en") or product.get("name_en"),
        "title_ar": product.get("title_ar") or product.get("name_ar"),
        "normalized_name_en": normalized_name or product.get("normalized_name_en") or product.get("normalized_title_en"),
        "slug": product.get("slug") or str(product.get("id") or ""),
        "price": product.get("price"),
        "final_price": product.get("final_price") or product.get("price"),
        "in_stock": 1 if product.get("in_stock", True) else 0,
        "image": product.get("image") or "",
        "description_en": product.get("description_en") or product.get("meta_description_en") or "",
        "description_ar": product.get("description_ar") or product.get("meta_description_ar") or "",
        "unit": product.get("unit") or "",
        "code": product.get("code") or "",
        "international_barcode": product.get("international_barcode") or "",
        "brand_id": brand_id,
        "category_l1_slug": _extract_category_slug(product, 1),
        "category_l2_slug": _extract_category_slug(product, 2),
        "category_l3_slug": _extract_category_slug(product, 3),
        "share_link": product.get("full_url") or product.get("url") or product.get("share_link") or "",
        "need_prescription": 1 if product.get("need_prescription") else 0,
        "source": product.get("_source") or product.get("source") or "chefaa",
        "raw_json": json.dumps(product, ensure_ascii=False),
        "normalized_at": _now_iso() if normalized_name else None,
        "updated_at": _now_iso(),
    }


def row_to_product_dict(row: Dict[str, Any]) -> Dict[str, Any]:
    """Reconstruct the product dict shape expected by ProductIndex."""
    if row.get("raw_json"):
        try:
            product = json.loads(row["raw_json"])
            if product.get("normalized_name_en") or row.get("normalized_name_en"):
                product["normalized_name_en"] = row.get("normalized_name_en") or product.get("normalized_name_en")
            return product
        except (json.JSONDecodeError, TypeError):
            pass

    brand_obj = None
    if row.get("brand_id"):
        brand_obj = {
            "id": row["brand_id"],
            "title_en": "",
            "title_ar": "",
        }

    cat_l1 = None
    if row.get("category_l1_slug"):
        cat_l1 = {"slug": row["category_l1_slug"], "title_en": "", "title_ar": ""}

    return {
        "id": row["id"],
        "title_en": row.get("title_en"),
        "title_ar": row.get("title_ar"),
        "normalized_name_en": row.get("normalized_name_en"),
        "slug": row.get("slug"),
        "price": row.get("price"),
        "final_price": row.get("final_price"),
        "in_stock": bool(row.get("in_stock", 1)),
        "image": row.get("image"),
        "description_en": row.get("description_en"),
        "description_ar": row.get("description_ar"),
        "unit": row.get("unit"),
        "code": row.get("code"),
        "international_barcode": row.get("international_barcode"),
        "brands": brand_obj,
        "level_one_category": cat_l1,
        "level_two_category": {"slug": row["category_l2_slug"]} if row.get("category_l2_slug") else None,
        "level_three_category": {"slug": row["category_l3_slug"]} if row.get("category_l3_slug") else None,
        "full_url": row.get("share_link"),
        "need_prescription": bool(row.get("need_prescription")),
        "source": row.get("source") or "chefaa",
    }


_INSERT_STAGING_SQL = """
    INSERT OR REPLACE INTO catalog_products_staging (
        id, title_en, title_ar, normalized_name_en, slug, price, final_price,
        in_stock, image, description_en, description_ar, unit, code,
        international_barcode, brand_id, category_l1_slug, category_l2_slug,
        category_l3_slug, share_link, need_prescription, source, raw_json,
        normalized_at, updated_at
    ) VALUES (
        :id, :title_en, :title_ar, :normalized_name_en, :slug, :price, :final_price,
        :in_stock, :image, :description_en, :description_ar, :unit, :code,
        :international_barcode, :brand_id, :category_l1_slug, :category_l2_slug,
        :category_l3_slug, :share_link, :need_prescription, :source, :raw_json,
        :normalized_at, :updated_at
    )
"""


def clear_staging() -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM catalog_products_staging")


def import_products_to_staging(products: List[Dict[str, Any]], *, clear_first: bool = True) -> int:
    return import_products_to_staging_batched(
        products,
        clear_first=clear_first,
    )


def import_products_to_staging_batched(
    products: List[Dict[str, Any]],
    *,
    clear_first: bool = True,
    batch_size: int = 500,
    on_progress: Optional[Any] = None,
    should_cancel: Optional[Any] = None,
) -> int:
    """Insert staging products in commits batches so progress is visible and memory stays bounded."""
    if clear_first:
        clear_staging()
    if not products:
        return 0

    total = len(products)
    imported = 0

    for start in range(0, total, batch_size):
        if should_cancel and should_cancel():
            raise PipelineCancelled()

        chunk = products[start : start + batch_size]
        rows = [product_record_to_row(p) for p in chunk if p.get("id") or p.get("slug")]
        if rows:
            with get_connection() as conn:
                conn.executemany(_INSERT_STAGING_SQL, rows)
            imported += len(rows)

        if on_progress:
            on_progress(imported, total)

    return imported


def import_products_to_live(products: List[Dict[str, Any]], *, replace: bool = True) -> int:
    if replace:
        with get_connection() as conn:
            conn.execute("DELETE FROM catalog_products")
    return _import_to_table("catalog_products", products)


def _import_to_table(table: str, products: List[Dict[str, Any]]) -> int:
    if not products:
        return 0
    rows = [product_record_to_row(p) for p in products if p.get("id") or p.get("slug")]
    sql = _INSERT_STAGING_SQL.replace("catalog_products_staging", table)
    with get_connection() as conn:
        conn.executemany(sql, rows)
    return len(rows)


def get_staging_products(*, offset: int = 0, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    sql = "SELECT * FROM catalog_products_staging ORDER BY id"
    params: list[Any] = []
    if limit is not None:
        sql += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
    with get_connection() as conn:
        cur = conn.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def get_staging_raw_json_batch(*, offset: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
    """Lightweight staging page for brand extraction (id + raw_json only)."""
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT id, raw_json FROM catalog_products_staging
            ORDER BY id
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        )
        return [dict(r) for r in cur.fetchall()]


def get_staging_count() -> int:
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM catalog_products_staging").fetchone()
        return int(row["c"]) if row else 0


def sync_live_to_staging() -> int:
    """Copy live catalog into staging for re-normalize workflows."""
    with get_connection() as conn:
        conn.execute("DELETE FROM catalog_products_staging")
        conn.execute(
            """
            INSERT INTO catalog_products_staging (
                id, title_en, title_ar, normalized_name_en, slug, price, final_price,
                in_stock, image, description_en, description_ar, unit, code,
                international_barcode, brand_id, category_l1_slug, category_l2_slug,
                category_l3_slug, share_link, need_prescription, source, raw_json,
                normalized_at, updated_at
            )
            SELECT
                id, title_en, title_ar, normalized_name_en, slug, price, final_price,
                in_stock, image, description_en, description_ar, unit, code,
                international_barcode, brand_id, category_l1_slug, category_l2_slug,
                category_l3_slug, share_link, need_prescription, source, raw_json,
                normalized_at, updated_at
            FROM catalog_products
            """
        )
        row = conn.execute("SELECT COUNT(*) AS c FROM catalog_products_staging").fetchone()
        return int(row["c"]) if row else 0


def count_unnormalized_staging() -> int:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS c FROM catalog_products_staging
            WHERE normalized_name_en IS NULL OR normalized_name_en = ''
            """
        ).fetchone()
        return int(row["c"]) if row else 0


def get_unnormalized_staging_batch(limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT id, title_en, title_ar FROM catalog_products_staging
            WHERE normalized_name_en IS NULL OR normalized_name_en = ''
            ORDER BY id
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(r) for r in cur.fetchall()]


def update_staging_normalized(product_id: str, normalized_name: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE catalog_products_staging
            SET normalized_name_en = ?, normalized_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (normalized_name, _now_iso(), _now_iso(), product_id),
        )


def normalize_staging_batch(
    normalizer_fn,
    *,
    batch_size: int = 500,
    on_progress=None,
    should_cancel=None,
    progress_interval: int = 100,
) -> int:
    """Run normalizer on staging products missing normalized_name_en."""
    with get_connection() as conn:
        total_row = conn.execute(
            """
            SELECT COUNT(*) AS c FROM catalog_products_staging
            WHERE normalized_name_en IS NULL OR normalized_name_en = ''
            """
        ).fetchone()
        total = int(total_row["c"]) if total_row else 0
        processed = 0

        while True:
            if should_cancel and should_cancel():
                raise PipelineCancelled()

            rows = conn.execute(
                """
                SELECT id, title_en, title_ar FROM catalog_products_staging
                WHERE normalized_name_en IS NULL OR normalized_name_en = ''
                ORDER BY id
                LIMIT ?
                """,
                (batch_size,),
            ).fetchall()

            if not rows:
                break

            for row in rows:
                if should_cancel and should_cancel():
                    raise PipelineCancelled()

                title = row["title_en"] or row["title_ar"] or ""
                if not title:
                    normalized = str(row["id"])
                else:
                    normalized = normalizer_fn(title)
                conn.execute(
                    """
                    UPDATE catalog_products_staging
                    SET normalized_name_en = ?, normalized_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (normalized, _now_iso(), _now_iso(), row["id"]),
                )
                processed += 1

                if on_progress and (
                    processed % progress_interval == 0 or processed == total
                ):
                    on_progress(processed, total)

            conn.commit()

        if on_progress and processed > 0 and processed % progress_interval != 0:
            on_progress(processed, total)

    return processed


def promote_staging_to_live() -> int:
    """Atomically replace live catalog with staging data."""
    with get_connection() as conn:
        staging_count = conn.execute("SELECT COUNT(*) AS c FROM catalog_products_staging").fetchone()
        count = int(staging_count["c"]) if staging_count else 0
        if count == 0:
            raise ValueError("Staging catalog is empty — cannot promote.")

        conn.execute("DELETE FROM catalog_products")
        conn.execute(
            """
            INSERT INTO catalog_products (
                id, title_en, title_ar, normalized_name_en, slug, price, final_price,
                in_stock, image, description_en, description_ar, unit, code,
                international_barcode, brand_id, category_l1_slug, category_l2_slug,
                category_l3_slug, share_link, need_prescription, source, raw_json,
                normalized_at, updated_at
            )
            SELECT
                id, title_en, title_ar, normalized_name_en, slug, price, final_price,
                in_stock, image, description_en, description_ar, unit, code,
                international_barcode, brand_id, category_l1_slug, category_l2_slug,
                category_l3_slug, share_link, need_prescription, source, raw_json,
                normalized_at, updated_at
            FROM catalog_products_staging
            """
        )
        conn.execute("DELETE FROM catalog_products_staging")
    return count


def get_live_count() -> int:
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM catalog_products").fetchone()
        return int(row["c"]) if row else 0


def load_live_products_for_index() -> List[Dict[str, Any]]:
    """Load all live catalog products as dicts for ProductIndex."""
    with get_connection() as conn:
        cur = conn.execute("SELECT * FROM catalog_products ORDER BY id")
        return [row_to_product_dict(dict(r)) for r in cur.fetchall()]


def get_catalog_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        live = conn.execute("SELECT COUNT(*) AS c FROM catalog_products").fetchone()
        staging = conn.execute("SELECT COUNT(*) AS c FROM catalog_products_staging").fetchone()
        normalized = conn.execute(
            "SELECT COUNT(*) AS c FROM catalog_products WHERE normalized_name_en IS NOT NULL AND normalized_name_en != ''"
        ).fetchone()
        with_codes = conn.execute(
            "SELECT COUNT(*) AS c FROM catalog_products WHERE code IS NOT NULL AND code != ''"
        ).fetchone()
        with_barcodes = conn.execute(
            "SELECT COUNT(*) AS c FROM catalog_products WHERE international_barcode IS NOT NULL AND international_barcode != ''"
        ).fetchone()
        meta = conn.execute("SELECT value FROM schema_meta WHERE key = 'last_promoted_at'").fetchone()

    return {
        "live_products": int(live["c"]) if live else 0,
        "staging_products": int(staging["c"]) if staging else 0,
        "normalized_products": int(normalized["c"]) if normalized else 0,
        "with_codes": int(with_codes["c"]) if with_codes else 0,
        "with_barcodes": int(with_barcodes["c"]) if with_barcodes else 0,
        "last_promoted_at": meta["value"] if meta else None,
        "source": "sqlite",
    }


def set_meta(key: str, value: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)",
            (key, value),
        )


def get_live_product(product_id: str) -> Optional[Dict[str, Any]]:
    """Return a live catalog product row by id, or None."""
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT * FROM catalog_products WHERE id = ?",
            (str(product_id),),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_product_codes(
    product_id: str,
    *,
    international_barcode: Optional[str] = None,
    code: Optional[str] = None,
) -> bool:
    """
    Patch live catalog product barcode/code columns and mirror into raw_json.
    Returns True if a row was updated.
    """
    product_id = str(product_id)
    row = get_live_product(product_id)
    if not row:
        return False

    new_barcode = row.get("international_barcode") or ""
    new_code = row.get("code") or ""
    if international_barcode is not None:
        new_barcode = international_barcode.strip()
    if code is not None and code.strip():
        new_code = code.strip()

    raw = {}
    if row.get("raw_json"):
        try:
            raw = json.loads(row["raw_json"])
            if not isinstance(raw, dict):
                raw = {}
        except (json.JSONDecodeError, TypeError):
            raw = {}

    raw["international_barcode"] = new_barcode
    raw["code"] = new_code

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE catalog_products
            SET international_barcode = ?,
                code = ?,
                raw_json = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (new_barcode, new_code, json.dumps(raw, ensure_ascii=False), _now_iso(), product_id),
        )
    return True
