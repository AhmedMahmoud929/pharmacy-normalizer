import json
import os
import argparse
import sys
from rich.console import Console
from rich.panel import Panel

# Ensure console handles UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description="Chefaa Catalog Slugs Comparer & Deduplicator")
    parser.add_argument("--new-slugs", type=str, default="data/chefaa_slugs_eg.txt", help="Path to newly fetched slugs list [default: data/chefaa_slugs_eg.txt]")
    parser.add_argument("--existing-data", type=str, default="backend/data/crawler/jobs/3d693bd9-b1fa-439e-986f-882b4659f0b2/results_cleaned.json", help="Path to existing scraped database file")
    parser.add_argument("--output", type=str, default="data/slugs_to_scrape.txt", help="Path to save unique slugs that need to be scraped")
    args = parser.parse_args()

    console = Console()
    console.print("[bold cyan]Chefaa Catalog Compare & Deduplication Utility[/bold cyan]\n")

    # 1. Read newly fetched slugs
    if not os.path.exists(args.new-slugs):
        # Check if the json version exists and extract from it if needed
        json_version = args.new-slugs.replace(".txt", ".json")
        if os.path.exists(json_version):
            console.print(f"[yellow]⚠ TXT file not found, loading from JSON instead: {json_version}[/yellow]")
            with open(json_version, 'r', encoding='utf-8') as f:
                raw_json = json.load(f)
                if raw_json and isinstance(raw_json[0], dict):
                    new_slugs = set(item.get('slug') for item in raw_json if item.get('slug'))
                else:
                    new_slugs = set(raw_json)
        else:
            console.print(f"[bold red]❌ Error: New slugs file not found at {args.new-slugs}[/bold red]")
            console.print("Please run the fetcher first: [bold green]python shefaa-crawler/fetch_slugs.py[/bold green]")
            sys.exit(1)
    else:
        with open(args.new-slugs, 'r', encoding='utf-8') as f:
            new_slugs = set(line.strip() for line in f if line.strip())

    # 2. Read existing scraped database
    if not os.path.exists(args.existing_data):
        console.print(f"[bold red]❌ Error: Existing database not found at {args.existing_data}[/bold red]")
        sys.exit(1)

    console.print(f"[yellow]Loading existing database ({os.path.basename(args.existing_data)})...[/yellow]")
    try:
        with open(args.existing_data, 'r', encoding='utf-8') as f:
            existing_db = json.load(f)
        
        # Extract 'id' (which is the slug in your results_cleaned.json schema)
        existing_slugs = set(item.get('id') for item in existing_db if item.get('id'))
    except Exception as e:
        console.print(f"[bold red]❌ Error loading existing database: {e}[/bold red]")
        sys.exit(1)

    # 3. Perform High-Speed Set Comparisons
    total_new_catalog = len(new_slugs)
    total_existing = len(existing_slugs)

    # Slugs in the new catalog that are NOT in your existing scraped data
    missing_slugs = new_slugs - existing_slugs
    
    # Slugs in your database that are no longer present in Chefaa catalog (removed/discontinued products)
    discontinued_slugs = existing_slugs - new_slugs

    # Slugs present in both lists (already scraped and still in catalog)
    up_to_date_count = len(new_slugs & existing_slugs)

    # 4. Print beautiful analytical report
    report_text = (
        f"📊 [bold]Total Catalog size on Chefaa:[/bold] [cyan]{total_new_catalog:,}[/cyan]\n"
        f"✅ [bold]Total Products you already scraped:[/bold] [green]{total_existing:,}[/green]\n"
        f"⭐ [bold]Already Scraped & Up-to-date:[/bold] [green]{up_to_date_count:,}[/green]\n\n"
        f"🔥 [bold yellow]New Products to Fetch (Missing):[/bold yellow] [bold red]{len(missing_slugs):,}[/bold red]\n"
        f"🗑️ [bold gray]Products discontinued/removed from Chefaa:[/bold gray] [gray]{len(discontinued_slugs):,}[/gray]"
    )
    
    console.print(Panel(report_text, title="Deduplication Analytics", expand=False))

    # 5. Save output file
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write("\n".join(missing_slugs) + "\n")
        
    console.print(f"\n[bold green]✔ Saved target list of missing products to fetch: {args.output}[/bold green]")
    console.print("You can now feed this list directly into your scraper to fetch only the missing details!")

if __name__ == "__main__":
    main()
