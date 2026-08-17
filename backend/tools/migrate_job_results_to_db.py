"""One-off migration: import legacy matcher/enrichment results.json files into SQLite."""

from __future__ import annotations

import os
import sys

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from tools.matcher_db import get_jobs as get_matcher_jobs, load_results as load_matcher_results, init_db as init_matcher_db
from tools.enrichment_db import get_jobs as get_enrichment_jobs, load_results as load_enrichment_results, init_db as init_enrichment_db


def main() -> None:
    init_matcher_db()
    init_enrichment_db()

    matcher_data = get_matcher_jobs(limit=1000, offset=0)
    for job in matcher_data.get("jobs", []):
        jid = job["job_id"]
        rows = load_matcher_results(jid)
        print(f"matcher {jid[:8]} -> {len(rows)} rows in DB")

    for job in get_enrichment_jobs(limit=1000, offset=0):
        jid = job["job_id"]
        rows = load_enrichment_results(jid)
        print(f"enrichment {jid[:8]} -> {len(rows)} rows in DB")


if __name__ == "__main__":
    main()
