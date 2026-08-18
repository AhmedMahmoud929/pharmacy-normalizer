import os

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_ROOT, "data")
DEFAULT_DB_PATH = os.path.join(DATA_DIR, "pharmatcher.db")


def resolve_backend_root(workspace_root: str | None = None) -> str:
    """
    Resolve the backend directory from either:
    - None → default BACKEND_ROOT
    - repo root (contains backend/tools/shefaa-crawler)
    - backend root (contains tools/shefaa-crawler)
    """
    if workspace_root is None:
        return BACKEND_ROOT

    ws = os.path.abspath(workspace_root)
    if os.path.isdir(os.path.join(ws, "tools", "shefaa-crawler")):
        return ws
    nested = os.path.join(ws, "backend")
    if os.path.isdir(os.path.join(nested, "tools", "shefaa-crawler")):
        return nested
    return BACKEND_ROOT


def crawler_dir_path(workspace_root: str | None = None) -> str:
    return os.path.join(resolve_backend_root(workspace_root), "tools", "shefaa-crawler")
