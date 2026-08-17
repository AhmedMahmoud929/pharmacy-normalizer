"""On-disk data directories that can be cleaned alongside database tables."""

from __future__ import annotations

import os
from typing import Any, Dict, List, TypedDict

from db.config import DATA_DIR


class LocalFileTarget(TypedDict):
    id: str
    label: str
    description: str
    paths: List[str]
    category: str


def _target(id: str, label: str, description: str, *rel_paths: str, category: str) -> LocalFileTarget:
    return {
        "id": id,
        "label": label,
        "description": description,
        "paths": [os.path.join(DATA_DIR, p.replace("/", os.sep)) for p in rel_paths],
        "category": category,
    }


LOCAL_FILE_TARGETS: List[LocalFileTarget] = [
    _target(
        "matcher_job_files",
        "Matcher job uploads",
        "Uploaded spreadsheets and per-job working files under data/matcher/jobs/",
        "matcher/jobs",
        category="jobs",
    ),
    _target(
        "enrichment_job_files",
        "Enrichment job uploads",
        "Uploaded files for enrichment jobs under data/enrichment/jobs/",
        "enrichment/jobs",
        category="jobs",
    ),
    _target(
        "discovery_job_files",
        "Discovery job files",
        "Legacy discovery job JSON and artifacts under data/discovery/jobs/",
        "discovery/jobs",
        category="jobs",
    ),
    _target(
        "matcher_exports",
        "Matcher Excel exports",
        "Generated export spreadsheets under data/extracted/matcher_exports/",
        "extracted/matcher_exports",
        category="exports",
    ),
    _target(
        "media_products",
        "Product gallery media",
        "Cached product images under data/media/products/",
        "media/products",
        category="media",
    ),
    _target(
        "media_brands",
        "Brand gallery media",
        "Cached brand logos under data/media/brands/",
        "media/brands",
        category="media",
    ),
    _target(
        "media_categories",
        "Category gallery media",
        "Cached category images under data/media/categories/",
        "media/categories",
        category="media",
    ),
    _target(
        "crawler_job_files",
        "Crawler job output",
        "Crawler run artifacts (results JSON, logs, media zips) under data/extracted/crawler/jobs/ and data/crawler/jobs/",
        "extracted/crawler/jobs",
        "crawler/jobs",
        category="crawler",
    ),
]

TARGET_BY_ID: Dict[str, LocalFileTarget] = {t["id"]: t for t in LOCAL_FILE_TARGETS}


def _dir_stats(path: str) -> Dict[str, int | bool]:
    if not os.path.isdir(path):
        return {"exists": False, "file_count": 0, "size_bytes": 0}

    file_count = 0
    size_bytes = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            fp = os.path.join(root, name)
            try:
                size_bytes += os.path.getsize(fp)
                file_count += 1
            except OSError:
                pass
    return {"exists": True, "file_count": file_count, "size_bytes": size_bytes}


def list_local_file_targets() -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for target in LOCAL_FILE_TARGETS:
        total_files = 0
        total_bytes = 0
        path_stats: List[Dict[str, Any]] = []
        for path in target["paths"]:
            stats = _dir_stats(path)
            total_files += int(stats["file_count"])
            total_bytes += int(stats["size_bytes"])
            path_stats.append({"path": path, **stats})

        results.append({
            "id": target["id"],
            "label": target["label"],
            "description": target["description"],
            "category": target["category"],
            "file_count": total_files,
            "size_bytes": total_bytes,
            "paths": path_stats,
        })
    return results


def clean_local_targets(target_ids: List[str]) -> List[Dict[str, Any]]:
    cleaned: List[Dict[str, Any]] = []
    for target_id in target_ids:
        target = TARGET_BY_ID.get(target_id)
        if not target:
            raise ValueError(f"Unknown local file target: '{target_id}'")

        deleted_files = 0
        freed_bytes = 0
        path_results: List[Dict[str, Any]] = []

        for path in target["paths"]:
            result = _clean_directory(path)
            deleted_files += result["deleted_files"]
            freed_bytes += result["freed_bytes"]
            path_results.append(result)

        cleaned.append({
            "id": target_id,
            "label": target["label"],
            "deleted_files": deleted_files,
            "freed_bytes": freed_bytes,
            "paths": path_results,
        })
    return cleaned


def _clean_directory(path: str) -> Dict[str, Any]:
    deleted_files = 0
    freed_bytes = 0
    if not os.path.isdir(path):
        return {
            "path": path,
            "deleted_files": 0,
            "freed_bytes": 0,
            "skipped": True,
        }

    for root, dirs, files in os.walk(path, topdown=False):
        for name in files:
            fp = os.path.join(root, name)
            try:
                freed_bytes += os.path.getsize(fp)
                os.remove(fp)
                deleted_files += 1
            except OSError:
                pass
        for name in dirs:
            try:
                os.rmdir(os.path.join(root, name))
            except OSError:
                pass

    os.makedirs(path, exist_ok=True)
    return {
        "path": path,
        "deleted_files": deleted_files,
        "freed_bytes": freed_bytes,
        "skipped": False,
    }
