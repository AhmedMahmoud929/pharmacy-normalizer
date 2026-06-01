import sys
import os

# Adjust path to import from tools
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.api import CrawlRunRequest, compile_cli_args

def test_preset_compilation():
    print("Executing CrawlRunRequest compiler dry-runs...")
    
    # 1. test all-products
    req1 = CrawlRunRequest(preset="all-products", crawl_mode="both")
    args1 = compile_cli_args(req1, "job_test_1", "/dummy/root")
    print(f"\n[all-products] compiled flags:\n{args1}")
    assert "--products" in args1
    assert "all" in args1
    assert "--pages" in args1
    assert "--crawl-mode" in args1
    assert "both" in args1
    assert "--workers" in args1
    assert args1[args1.index("--workers") + 1] == "2"
    
    # 2. test first-n-categories
    req2 = CrawlRunRequest(preset="first-n-categories", preset_n=3, crawl_mode="catalog")
    args2 = compile_cli_args(req2, "job_test_2", "/dummy/root")
    print(f"\n[first-n-categories] compiled flags:\n{args2}")
    assert "--category-limit" in args2
    assert "3" in args2
    assert "--crawl-mode" in args2
    assert "catalog" in args2
    assert "--workers" in args2
    assert args2[args2.index("--workers") + 1] == "2"
    
    # 3. test resource-stats
    req3 = CrawlRunRequest(preset="resource-stats")
    args3 = compile_cli_args(req3, "job_test_3", "/dummy/root")
    print(f"\n[resource-stats] compiled flags:\n{args3}")
    assert "--stats-only" in args3
    assert "--workers" in args3
    assert args3[args3.index("--workers") + 1] == "2"
    
    # 4. test both-language translation
    req4 = CrawlRunRequest(lang="both", preset="resource-stats")
    args4 = compile_cli_args(req4, "job_test_4", "/dummy/root")
    print(f"\n[both-lang] compiled flags:\n{args4}")
    assert "--lang" in args4
    assert "both" not in args4
    assert "en" in args4
    assert "--localize" in args4
    assert "--workers" in args4
    assert args4[args4.index("--workers") + 1] == "2"
    
    print("\n✅ All compile_cli_args preset cases passed successfully!")

if __name__ == "__main__":
    test_preset_compilation()
