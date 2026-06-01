# 💊 Chefaa Enterprise Scraper & Localization Pipeline

An enterprise-grade, highly visual Python web scraping and data consolidation pipeline for extracting product catalogs, nested categories, and brand directories from the **Chefaa** pharmacy platform. 

This tool is engineered for robust storefront extraction, offering dual-language localization (English & Arabic), deep technical specification enrichment, and an automated media downloader that organizes assets into structured domain subdirectories.

---

## ✨ Key Features

- **⚡ Direct Meilisearch API Integration**: Queries Chefaa's public Meilisearch clusters directly to fetch the complete product catalog (bypassing region-bound HTML blocks and scaling retrieval from 2,700 items to **29,000+ products**).
- **🎛️ Price-Range Slicing Engine**: Automatically bypasses Meilisearch's 1,000-hit constraint by dynamically querying, bounds-checking, and recursively partitioning price ranges to ensure absolute catalog completeness.
- **📊 Live Category Statistics (`--stats-only`)**: Instantly fetches Meilisearch facet distributions to output a visual terminal dashboard detailing category slugs, localized Arabic/English names, and real-time product counts.
- **🌐 Comprehensive Localization (`--localize`)**: Consolidated extraction mapping brand details, localized product titles/descriptions, and multi-level category nodes simultaneously across English and Arabic paths.
- **🛡️ Deep Specification Scraping (`--deep`)**: Climbs product landing pages to parse plain text specifications, localized HTML rich-text overviews, and high-resolution carousel images.
- **📁 Structured Media Downloader (`--download`)**: Automatically downloads, validates, and categorizes static images into domain-specific subdirectories under `data/media/`.
- **✨ Visual Telemetry & CLI Experience**: Utilizes `rich` for custom terminal progress bars, session stats tables, execution blue-prints, and interactive execution tables.

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+**
- Active internet connection

### Installation
1. Clone the repository or navigate to your project directory.
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 📖 Command Line Interface (CLI) Usage

The script operates in two primary modes: **Silent CLI Mode** (triggered automatically when arguments are provided) and **Interactive Wizard Mode** (default fallback when no parameters are passed).

### 1. Scrape and Localize Products (All Pages + Media Download)
To execute a deep, localized scrape of all products inside the `medications` category, consolidating English and Arabic details, and downloading all media assets:

```bash
python main.py --products medications --pages all --deep --localize --output data/products_localized.json --download
```

**What this command does:**
- `--products medications`: Scrapes the `medications` storefront route.
- `--pages all`: Detects the maximum number of paginated results automatically and processes all pages.
- `--deep`: Visits each product details page to fetch descriptions, HTML overviews, brand details, and spec sheets.
- `--localize`: Matches corresponding EN & AR product pages, creating a unified bilingual JSON representation.
- `--download`: Downloads all product image assets and saves them to `data/media/products/`.
- `--output data/products_localized.json`: Exports the finalized structured JSON array.

---

### 2. Standard Product Scraping (Single Language, Single Page)
For a lightweight, single-page scrape of a category in a single language without climbing details pages:

```bash
python main.py --products medications --pages 1 --lang en --country eg --output data/products.json
```

---

### 3. Category & Subcategory Catalog Harvesting
Harvest the entire multi-level nesting category database:

- **Standard Categories Extract**:
  ```bash
  python main.py --categories --sub-categories --lang en --output data/categories.json
  ```
- **Bilingual Consolidated Extract with Covers Download**:
  ```bash
  python main.py --categories --sub-categories --localize --download --output data/categories_localized.json
  ```

---

### 4. Brand Directory Harvesting
Harvest all manufacturer and pharmacy brands:

```bash
python main.py --brands --localize --download --output data/brands_localized.json
```
- Brand logos will be downloaded and saved to `data/media/brands/`.

---

### 5. Live Category Statistics Dashboard
To query Meilisearch and render a real-time dashboard of all product categories, slugs, and exact product counts:

- **Egypt Catalog Statistics**:
  ```bash
  python main.py --stats-only --country eg
  ```
- **Saudi Arabia Catalog Statistics**:
  ```bash
  python main.py --stats-only --country sa
  ```

---

### 6. Interactive Wizard Mode
To start the guided terminal console wizard, simply run:

```bash
python main.py
```

---

## 🗄️ Database & Schema Specifications

The scraper produces clean, production-ready JSON schemas.

### Localized Product Entity Schema (`products_localized.json`)
```json
[
  {
    "id": "panadol-extra-tab",
    "brand": {
      "id": "brands/panadol",
      "names": {
        "en": "Panadol",
        "ar": "بانادول"
      },
      "logo_url": "https://chefaa.com/public/uploads/brands/panadol-logo.png"
    },
    "featured_image": "https://chefaa.com/public/uploads/products/panadol-extra.png",
    "images": [
      "https://chefaa.com/public/uploads/products/panadol-extra.png",
      "https://chefaa.com/public/uploads/products/panadol-extra-back.png"
    ],
    "names": {
      "en": "Panadol | Extra Optizorb Tablets for Pain and Fever | 24 Tabs",
      "ar": "بانادول | اكسترا اوبتي زوُرب مسكن للألم وخافض للحرارة | 24 قرص"
    },
    "price": "50.00",
    "currency": "EGP",
    "url": "/eg-en/now/product/panadol-extra-tab",
    "description": "Panadol Extra tablets provide effective relief from pain and reduce fever...",
    "overview": {
      "en": "<div id=\"nav-home\"><h3>Product Benefits</h3><ul><li>Fast relief...</li></ul></div>",
      "ar": "<div id=\"nav-home\"><h3>فوائد المنتج</h3><ul><li>تسكين سريع...</li></ul></div>"
    },
    "specification": {
      "Brand": "Panadol",
      "Format": "Tablets",
      "Strength": "500mg / 65mg"
    },
    "category": {
      "id": "medications",
      "names": {
        "en": "Medications",
        "ar": "الأدوية"
      }
    },
    "subcategory": {
      "id": "pain-relief",
      "names": {
        "en": "Pain Relief",
        "ar": "مسكنات الألم"
      }
    }
  }
]
```

---

## 📁 Media Storage Architecture

When the `--download` option is active, static image assets are pulled and organized into structured, highly accessible directories:

```text
data/
 ├── products_localized.json
 └── media/
      ├── products/
      │    ├── panadol-extra-tab.png
      │    └── doliprane-1000mg.png
      ├── categories/
      │    ├── medications.png
      │    └── skin-care.png
      └── brands/
           ├── panadol.png
           └── doliprane.png
```

---

## 🛠️ Technical Details & Resiliency

- **Dynamic Encoding Recovery**: Scraper parses response headers for character sets, automatically defaulting to `utf-8` with replacement strategies to prevent encoding errors on non-ASCII Arabic glyphs.
- **Bilingual slug mapping**: Items are matched between language paths using standard regex URL extraction and slugs, guaranteeing matching accuracy even under differing localization route strategies.
- **Graceful Retries**: If network connectivity issues occur during asset downloads or page requests, errors are logged gracefully to the standard output rather than halting execution.

---

## 📄 License
This project is proprietary and built for automated catalog integration pipelines. Use responsibly in accordance with platform terms of service.
