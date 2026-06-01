---
title: Decoupling Crawler and Transitioning Browse & Search to Chefaa Database
version: 1.0
date_created: 2026-05-26
owner: Engineering Team
tags: [architecture, design, backend, frontend, configuration]
---

# Introduction

This specification describes the architectural changes required to conditionally disable and remove the Shefaa Crawler feature from the user interface using a new environment variable, while migrating the master product catalog loaded by the backend API for both **browsing** and **global search** features to `data/chefaa_products_eg.json`.

This decoupling simplifies frontend operations, protects crawler routes, and aligns browse and search pages to serve real scraped Egyptian pharmacy products from the Chefaa dataset instead of the old reference database.

---

## 1. Purpose & Scope

### 1.1 Purpose
The purpose is twofold:
1. **Feature Flag Control**: Establish an environment-driven flag (`NEXT_PUBLIC_ENABLE_CRAWLER`) in the frontend Next.js application to remove access to and UI indicators of the crawler engine.
2. **Catalog Migration**: Update the backend indexer to load, parse, and serve the 126MB `data/chefaa_products_eg.json` dataset (which holds live Egyptian pharmacy products) rather than the previous `products_normalized.json` reference catalog, ensuring that the **Browse Database** and **Global Search** features operate directly over this Chefaa catalog.

### 1.2 Scope
- **Frontend App**: `Navbar.tsx`, `Footer.tsx`, and the routing layout `app/dashboard/crawler/layout.tsx`.
- **Backend API**: `backend/tools/api.py`, `backend/tools/matcher.py`, and startup database configurations.
- **Data Layers**: Transition from old sheets reference files to `data/chefaa_products_eg.json`.

---

## 2. Definitions

- **Crawler Feature**: The background crawler UI under `/dashboard/crawler` used to scrape Chefaa pages.
- **Browse DB Feature**: The master database explorer under `/dashboard/browse` showing all system products, brands, and categories.
- **Global Search Feature**: The instant fuzzy search console under `/dashboard/search` that performs real-time queries.
- **ProductIndex**: The in-memory token-based fuzzy matching index structure implemented in `backend/tools/matcher.py`.

---

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: **Environment Toggle Configuration**: The frontend application must declare and respect a `.env` environment variable called `NEXT_PUBLIC_ENABLE_CRAWLER='false'`.
- **REQ-002**: **Conditional Navigation Layouts**: The "Campaign Crawler" navigation tab must be completely omitted from the main application header (`Navbar.tsx`) and the footer layout (`Footer.tsx`) if `NEXT_PUBLIC_ENABLE_CRAWLER` is not set to `'true'`.
- **REQ-003**: **Route Hardening & Protection**: Direct access to `/dashboard/crawler` or its subpages (`/campaigns`, `/explorer`) must return a Next.js `notFound()` 404 page or trigger a redirect to protect against direct URL entry.
- **REQ-004**: **Chefaa Database Integration**: The backend service must load the `data/chefaa_products_eg.json` catalog at startup as the default database index.
- **REQ-005**: **Schema Translation Layer**: The backend `ProductIndex` must dynamically map the flat Chefaa product structure on startup to match the expected schema of the frontend browse and search pages, preventing UI layout or rendering crashes.
- **REQ-006**: **Fuzzy Search Integration**: The search endpoint `/match` must query the new Chefaa-indexed products, resolving confidence score rankings based on normalized `title_en` and `title_ar` matching.

### Constraints
- **CON-001 (Performance)**: Since `chefaa_products_eg.json` is a large file (approx 126 MB, 3 million+ lines), JSON load parsing on startup must be memory-efficient and avoid blocking the main server loop.
- **CON-002 (Backward Compatibility)**: Existing matching APIs (such as `/match` and `/match/sheet`) must continue to work seamlessly with the new indexing model, ensuring normal sheet normalization works out of the box.

---

## 4. Interfaces & Data Contracts

### 4.1 Schema Adaptation Mapping
Since `chefaa_products_eg.json` contains flat items representing individual product listings (rather than grouped product families with variants), the parser will translate the Chefaa schema into a unified product/variant envelope expected by both browse and search frontends.

#### Input Schema (`chefaa_products_eg.json` structure)
```json
{
  "id": 63314,
  "title_ar": "نوبيكا لعلاج أورام البروستاتا 300مجم | 112 قرص",
  "title_en": "Nubeqa to Treat Prostate Cancer 300mg | 112 Tabs",
  "price": 56939,
  "image": "https://cdn.chefaa.com/...png",
  "slug": "nubeqa-to-treat-prostate-cancer-300mg-112-tabs-ffe1",
  "in_stock": true,
  "final_price": 56939,
  "brands": {
    "id": 204,
    "title_ar": "باير للرعاية الصحية",
    "title_en": "Bayer Healthcare",
    "slug": "bayer-healthcare"
  },
  "level_one_category": {
    "title_ar": "الأدوية",
    "title_en": "Medications",
    "slug": "medications"
  },
  "full_url": "https://chefaa.com/..."
}
```

#### Output Schema (Mapped Product Envelope)
```json
{
  "id": "63314",
  "name_en": "Nubeqa to Treat Prostate Cancer 300mg | 112 Tabs",
  "name_ar": "نوبيكا لعلاج أورام البروستاتا 300مجم | 112 قرص",
  "sku": "nubeqa-to-treat-prostate-cancer-300mg-112-tabs-ffe1",
  "price": 56939,
  "brand": {
    "name": "Bayer Healthcare",
    "slug": "bayer-healthcare"
  },
  "category": {
    "name": "Medications",
    "slug": "medications"
  },
  "in_stock": true,
  "stock": 10,
  "share_link": "https://chefaa.com/...",
  "image": "https://cdn.chefaa.com/...png"
}
```

---

## 5. Acceptance Criteria

- **AC-001**: Given `NEXT_PUBLIC_ENABLE_CRAWLER='false'` in `.env`, When the frontend renders, Then "Campaign Crawler" does not appear in the Navigation Bar or the Footer.
- **AC-002**: Given the crawler is disabled, When a user visits `/dashboard/crawler` directly in the browser address bar, Then the application displays the standard Next.js 404 page or redirects to `/dashboard/matcher`.
- **AC-003**: Given the backend API is started, When `/db/products` is called, Then the returned dataset contains live product listings derived from `chefaa_products_eg.json`.
- **AC-004**: Given a global search query (e.g. "Panadol"), When `/match` is queried, Then the API returns fuzzy matched results from `chefaa_products_eg.json` ranked by similarity confidence score, populated with their respective brand and category strings.

---

## 6. Test Automation Strategy

### Unit and Integration Tests
- **Frontend Environment Tests**: Verify that the navigation wrapper correctly filters navigation links dynamically depending on `NEXT_PUBLIC_ENABLE_CRAWLER`.
- **Backend Schema Tests**: Create a mock json subset of `chefaa_products_eg.json` to verify that `ProductIndex` builds, normalizes Arabic/English terms on the fly, and properly registers mapping fields.
- **API Search Tests**: Assert that the search endpoint `/match` returns correct mapped entries with confidence scores greater than 0.

---

## 7. Rationale & Context

### 7.1 Crawler Disabling
A hard-coded feature can bloat client bundles and expose backend administration crawler triggers to unauthorized environments. Decoupling it behind a feature flag ensures that staging or production builds can quickly toggle it off, preventing rate limiting or accidental crawler runs.

### 7.2 Catalog Migration to `chefaa_products_eg.json`
Previously, the database browser and global search operated on static `products_normalized.json` from sheets, which did not represent real-time crawlers' product databases. Utilizing `chefaa_products_eg.json` ensures that both browsing and global search display real scraped Egyptian products with exact prices, Arabic titles, and live Chefaa images, improving normalization feedback loops.

---

## 8. Dependencies & External Integrations

### Data Dependencies
- **DAT-001**: `data/chefaa_products_eg.json` - Must exist at the project root with the raw scraped product array.

### Technology Platform Dependencies
- **PLT-001**: Next.js (Client Component Routing environment support)
- **PLT-002**: FastAPI (Startup event indexing capability)

---

## 9. Examples & Edge Cases

### 9.1 Frontend Navigation Exclusion (`Navbar.tsx` & `Footer.tsx`)
We conditionally render navigation lists by checking the environment variable:

```typescript
const isCrawlerEnabled = process.env.NEXT_PUBLIC_ENABLE_CRAWLER === "true";

const filteredNavItems = navItems.filter(item => {
  if (item.href.includes("/crawler")) {
    return isCrawlerEnabled;
  }
  return true;
});
```

### 9.2 Route Shield (`app/dashboard/crawler/layout.tsx`)
Prevent URL hacking at layout entrypoint:

```typescript
import { notFound } from "next/navigation";

export default function CrawlerLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_ENABLE_CRAWLER !== "true") {
    notFound();
  }
  
  // Render normal layout
  return <>{children}</>;
}
```

### 9.3 Backend `ProductIndex` Schema Normalizer Parser (`backend/tools/matcher.py`)
Handling both old legacy schemas and the flat Chefaa structure dynamically:

```python
def _build_index(self, products_data: List[Dict[str, Any]]):
    for product in products_data:
        if "product_variants" in product:
            # Legacy format processing
            parent_norm = product.get("normalized_name_en")
            for variant in product.get("product_variants", []):
                var_norm = variant.get("normalized_name_en") or parent_norm
                if not var_norm: continue
                idx = len(self.entries)
                tokens = set(var_norm.split())
                self.entries.append({"normalized": var_norm, "tokens": tokens, "product": product, "variant": variant})
                for token in tokens:
                    if token not in self.token_map: self.token_map[token] = []
                    self.token_map[token].append(idx)
        else:
            # Chefaa flat format processing
            title_en = product.get("title_en") or ""
            var_norm = product.get("normalized_name_en") or normalize(title_en)
            if not var_norm: continue
            
            # Map complex brand and category values
            brand_data = product.get("brands")
            brand_obj = None
            if brand_data:
                brand_obj = {
                    "name": brand_data.get("title_en") or brand_data.get("title_ar"),
                    "slug": brand_data.get("slug")
                }
            
            cat_data = product.get("level_one_category")
            cat_obj = None
            if cat_data:
                cat_obj = {
                    "name": cat_data.get("title_en") or cat_data.get("title_ar"),
                    "slug": cat_data.get("slug")
                }
            
            # Build unified product/variant object
            mapped_item = {
                "id": str(product.get("id")),
                "name_en": product.get("title_en"),
                "name_ar": product.get("title_ar"),
                "sku": product.get("slug") or str(product.get("id")),
                "brand": brand_obj,
                "category": cat_obj,
                "price": product.get("final_price") or product.get("price") or 0,
                "in_stock": product.get("in_stock", True),
                "stock": 10 if product.get("in_stock", True) else 0,
                "share_link": product.get("full_url") or product.get("url") or "",
                "image": product.get("image") or ""
            }
            
            idx = len(self.entries)
            tokens = set(var_norm.split())
            self.entries.append({
                "normalized": var_norm,
                "tokens": tokens,
                "product": mapped_item,
                "variant": mapped_item
            })
            for token in tokens:
                if token not in self.token_map: self.token_map[token] = []
                self.token_map[token].append(idx)
```

---

## 10. Validation Criteria

### 10.1 Verify Crawler Removal
1. Run `pnpm run dev` for the frontend.
2. Confirm the navbar and footer have **no** reference to "Campaign Crawler".
3. Access `http://localhost:3000/dashboard/crawler` in the browser. Verify a standard Next.js 404 (Not Found) page is shown.

### 10.2 Verify Catalog Browse & Global Search Database
1. Run backend using `uvicorn tools.api:app --reload` or standard launch script.
2. Verify terminal logs indicate database loaded successfully from the Chefaa dataset path.
3. Access **Database Browser** in the frontend, check that the list is populated with products from `chefaa_products_eg.json` (e.g. Nubeqa, Xtandi, Erleada).
4. Perform a search inside the **Global Search** interface, verify that search scores and results are instantly returned with active thumbnail images and correct attributes.

---

## 11. Related Specifications / Further Reading

- [Next.js Environment Variables Documentation](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [FastAPI Startup Events](https://fastapi.tiangolo.com/advanced/events/)
