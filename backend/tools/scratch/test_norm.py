import os
import sys

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Fix imports to allow importing from tools/ matcher and normalizer
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.append(project_root)

from normalizer import normalize

q = "بانادول ٥٠٠ مجم"
print(f"Original: {q}")
norm = normalize(q)
print(f"Normalized: {norm}")
