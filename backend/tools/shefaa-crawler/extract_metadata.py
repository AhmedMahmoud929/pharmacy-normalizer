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
    parser = argparse.ArgumentParser(description="Extract Brands and Categories from Chefaa Products Database")
    parser.add_argument("file_path", type=str, nargs="?", default="data/chefaa_products_eg.json", help="Path to the JSON database [default: data/chefaa_products_eg.json]")
    args = parser.parse_args()

    console = Console()
    console.print("[bold magenta]✨ Chefaa Metadata Extractor (Brands & Categories Builder)[/bold magenta]\n")

    if not os.path.exists(args.file_path):
        console.print(f"[bold red]❌ Error: Database file not found at {args.file_path}[/bold red]")
        console.print("Please fetch the complete product database first using: [bold green]python shefaa-crawler/fetch_slugs.py --full-db[/bold green]")
        sys.exit(1)

    console.print(f"[yellow]Loading product database from [bold]{args.file_path}[/bold]...[/yellow]")
    try:
        with open(args.file_path, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except Exception as e:
        console.print(f"[bold red]❌ Error parsing JSON database: {e}[/bold red]")
        sys.exit(1)

    console.print(f"[green]✔ Loaded {len(products):,} products successfully.[/green]\n")
    console.print("[yellow]Extracting unique brands and categories...[/yellow]")

    brands = {}
    categories = {}

    for product in products:
        if not isinstance(product, dict):
            continue

        # 1. Extract Brand
        brand_obj = product.get('brands')
        if brand_obj and isinstance(brand_obj, dict):
            b_id = brand_obj.get('id')
            b_slug = brand_obj.get('slug')
            key = b_slug or str(b_id) if (b_slug or b_id) else None
            
            if key and key not in brands:
                # Get brand logo image cleanly
                logo = brand_obj.get('images') or brand_obj.get('logo_url')
                brands[key] = {
                    'id': b_id,
                    'name_ar': brand_obj.get('title_ar', '').strip(),
                    'name_en': brand_obj.get('title_en', '').strip(),
                    'slug': b_slug,
                    'logo_url': logo
                }

        # 2. Extract Category Taxonomy (3 Levels Structure)
        # Level 1
        l1 = product.get('level_one_category')
        l1_slug = None
        if l1 and isinstance(l1, dict):
            l1_slug = l1.get('slug')
            if l1_slug and l1_slug not in categories:
                categories[l1_slug] = {
                    'level': 1,
                    'name_ar': l1.get('title_ar', '').strip(),
                    'name_en': l1.get('title_en', '').strip(),
                    'slug': l1_slug,
                    'parent_slug': None
                }

        # Level 2 (usually a list of dicts, but could be a single dict)
        l2_list = product.get('level_two_category') or []
        if isinstance(l2_list, dict):
            l2_list = [l2_list]
        
        l2_slug = None
        for l2 in l2_list:
            if l2 and isinstance(l2, dict):
                l2_slug = l2.get('slug')
                if l2_slug and l2_slug not in categories:
                    categories[l2_slug] = {
                        'level': 2,
                        'name_ar': l2.get('title_ar', '').strip(),
                        'name_en': l2.get('title_en', '').strip(),
                        'slug': l2_slug,
                        'parent_slug': l1_slug
                    }

        # Level 3 (usually a list of dicts)
        l3_list = product.get('level_three_category') or []
        if isinstance(l3_list, dict):
            l3_list = [l3_list]
            
        for l3 in l3_list:
            if l3 and isinstance(l3, dict):
                l3_slug = l3.get('slug')
                if l3_slug and l3_slug not in categories:
                    categories[l3_slug] = {
                        'level': 3,
                        'name_ar': l3.get('title_ar', '').strip(),
                        'name_en': l3.get('title_en', '').strip(),
                        'slug': l3_slug,
                        # If level 2 is present, link level 3 to it
                        'parent_slug': l2_slug if l2_slug else l1_slug
                    }

    # Convert dictionaries to list arrays for clean output
    brands_list = list(brands.values())
    categories_list = list(categories.values())

    # Sort categories by level and then slug
    categories_list.sort(key=lambda x: (x['level'], x['slug']))
    # Sort brands by name or slug
    brands_list.sort(key=lambda x: x['slug'] if x['slug'] else "")

    # Output paths
    output_dir = os.path.dirname(args.file_path)
    brands_path = os.path.join(output_dir, "extracted_brands_eg.json")
    categories_path = os.path.join(output_dir, "extracted_categories_eg.json")

    # Save to files
    with open(brands_path, 'w', encoding='utf-8') as f:
        json.dump(brands_list, f, indent=4, ensure_ascii=False)

    with open(categories_path, 'w', encoding='utf-8') as f:
        json.dump(categories_list, f, indent=4, ensure_ascii=False)

    # Print success report
    report_text = (
        f"📊 [bold]Analyzed Products Count:[/bold] [cyan]{len(products):,}[/cyan]\n\n"
        f"🏆 [bold green]Extracted Unique Brands:[/bold green] [bold]{len(brands_list):,}[/bold] brands\n"
        f"🌳 [bold green]Extracted Unique Categories Hierarchy:[/bold green] [bold]{len(categories_list):,}[/bold] categories\n\n"
        f"📂 [bold yellow]Files Saved Successfully in '{output_dir}/':[/bold yellow]\n"
        f"  • [green]✔ {os.path.basename(brands_path)}[/green] (Clean brands dataset)\n"
        f"  • [green]✔ {os.path.basename(categories_path)}[/green] (Hierarchical taxonomy tree)"
    )

    console.print(Panel(report_text, title="Extraction Analytics & Output Report", expand=False))
    console.print("\n[bold green]Success! All metadata tables have been generated perfectly.[/bold green]")

if __name__ == "__main__":
    main()
