"""HTML fetching for discovery — wraps shefaa-crawler fetch_html."""

from __future__ import annotations

import importlib.util
import os


_FETCH_HTML = None


def _get_fetch_html():
    global _FETCH_HTML
    if _FETCH_HTML is not None:
        return _FETCH_HTML

    # html_fetcher.py lives at backend/tools/discovery/
    tools_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main_path = os.path.join(tools_dir, "shefaa-crawler", "main.py")
    if not os.path.exists(main_path):
        raise FileNotFoundError(f"Crawler module not found at {main_path}")

    spec = importlib.util.spec_from_file_location("shefaa_crawler_main", main_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _FETCH_HTML = module.fetch_html
    return _FETCH_HTML


def fetch_html(url: str) -> str:
    return _get_fetch_html()(url)
