import urllib.request
import urllib.error
import json
import sys
from rich.console import Console
from rich.table import Table

# Ensure console handles UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def probe_index(base_url, headers, index_name):
    """Sends a minimal check request to verify if an index exists and get its hit count."""
    url = f"{base_url}/indexes/{index_name}/search"
    payload = {
        'q': '',
        'limit': 0
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            parsed = json.loads(res.read().decode('utf-8'))
            return True, parsed.get('estimatedTotalHits', 0), None
    except urllib.error.HTTPError as e:
        # 404 means index does not exist, 403/401 means forbidden
        return False, 0, f"HTTP {e.code}"
    except Exception as e:
        return False, 0, str(e)

def main():
    console = Console()
    console.print("[bold magenta]🔍 Chefaa Backend Database Scanner (Index Prober)[/bold magenta]\n")
    console.print("[yellow]Probing server for active database indexes...[/yellow]\n")

    base_url = "https://meilisearch.chefaa.com"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': 'Bearer aa66bf66db30dea9b9746c8f6397d7a0112a055c70d80527b300c3dec85fcc41',
        'Content-Type': 'application/json'
    }

    # List of possible index candidates on Chefaa's server
    candidates = [
        # Products
        "products_eg", "products_sa", "products_ae", "products_ar", "products_en", "products",
        # Brands
        "brands_eg", "brands_sa", "brands_ae", "brands", "brand_eg", "brand_sa",
        # Categories
        "categories_eg", "categories_sa", "categories_ae", "categories", "category_eg", "category_sa",
        # Blog / Content
        "articles_eg", "articles_sa", "articles", "posts_eg", "posts", "blogs_eg", "blogs",
        # Search Suggestions
        "queries_eg", "queries_sa", "suggestions_eg", "suggestions_sa", "keywords_eg", "suggestions",
        # Partner Pharmacies / Stores / Zones
        "zones_eg", "zones_sa", "pharmacies_eg", "pharmacies", "stores_eg", "stores"
    ]

    # Remove duplicates from candidates list while preserving order
    seen = set()
    candidates = [x for x in candidates if not (x in seen or seen.add(x))]

    table = Table(title="Index Probing Results")
    table.add_column("Index Name", style="cyan", no_wrap=True)
    table.add_column("Status", style="bold")
    table.add_column("Record Count", style="green", justify="right")
    table.add_column("Details", style="dim")

    active_count = 0

    for idx, index_name in enumerate(candidates):
        exists, count, err = probe_index(base_url, headers, index_name)
        if exists:
            active_count += 1
            table.add_row(index_name, "[green]✔ ACTIVE[/green]", f"{count:,}", "Searchable Database")
        else:
            # We don't display non-existent indexes to keep output extremely clean,
            # unless it's a permission issue or unexpected error.
            if err and "403" in err:
                table.add_row(index_name, "[red]❌ FORBIDDEN[/red]", "-", "Authentication Blocked")

    if active_count > 0:
        console.print(table)
        console.print(f"\n[bold green]Scan complete! Found {active_count} active databases on Chefaa's backend server.[/bold green]")
    else:
        console.print("[yellow]⚠ Prober completed. No active public indexes were found from the candidate list.[/yellow]")

if __name__ == "__main__":
    main()
