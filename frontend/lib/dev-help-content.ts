export type DevHelpSection = {
  id: string;
  title: string;
  summary: string;
  bullets?: string[];
  subsections?: {
    title: string;
    content?: string;
    items?: string[];
  }[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  code?: string;
  note?: string;
};

export const DEV_HELP_SECTIONS: DevHelpSection[] = [
  {
    id: "architecture",
    title: "Overall Architecture",
    summary:
      "PharmMatcher stores almost all application state in a single SQLite database (pharmatcher.db) plus a few on-disk folders for media and exports.",
    bullets: [
      "Primary database: backend/data/pharmatcher.db — catalog, users, normalizer mappings, job history, discovery sources.",
      "In-memory catalog index loaded at API startup — matcher, search, browse, and enrichment read from this index for speed.",
      "After catalog changes (promote, import, enrichment apply, DB restore), the index is reloaded automatically.",
      "Campaign Crawler is the exception: it still uses backend/data/extracted/crawler_jobs.db and per-job JSON output files.",
    ],
    table: {
      headers: ["Storage", "What lives there"],
      rows: [
        ["pharmatcher.db", "Catalog, users, normalizer, all job tables (matcher, discovery, enrichment)"],
        ["data/media/", "Locally cached product & brand images (Media Gallery)"],
        ["data/extracted/matcher_exports/", "Pre-generated Match Sheet Excel files"],
        ["data/crawler/jobs/", "Crawler campaign output JSON (if crawler enabled)"],
      ],
    },
  },
  {
    id: "auth",
    title: "Authentication",
    summary: "JWT-based login protects the dashboard and API. Tokens are shared between localStorage and a cookie.",
    subsections: [
      {
        title: "Login flow",
        content: "Route: /login",
        items: [
          "POST /api/auth/login with email + password.",
          "Returns access_token + user object (role, permissions).",
          "Token stored as pharmatch_token in localStorage and as a cookie.",
          "AuthProvider patches fetch to attach Authorization: Bearer automatically.",
          "401 on protected routes logs the user out and redirects to login.",
          "Wrong-password 401s (DB admin, matcher delete) do NOT trigger logout.",
        ],
      },
      {
        title: "Permissions",
        content: "Admins get every module. Regular users get a subset assigned in User Management.",
        items: [
          "matcher, enrichment, discovery, catalog, crawler, browse, gallery, search, normalize, users",
          "Sidebar and route guards hide modules you cannot access.",
          "Database Settings requires admin role on the API even if you have users permission.",
        ],
      },
    ],
  },
  {
    id: "matcher",
    title: "Match Sheet",
    summary:
      "Upload a pharmacy inventory sheet and fuzzy-match each row against the live product catalog.",
    subsections: [
      {
        title: "Routes",
        content: "/dashboard/matcher — campaign list & stats. /dashboard/matcher/new — upload, run, review.",
      },
      {
        title: "Workflow",
        items: [
          "Upload Excel/CSV and pick the product name column (auto-detected).",
          "Configure match/review thresholds (defaults: 0.60 / 0.40).",
          "Optional: price, stock, barcode, POS code columns for export or barcode-first matching.",
          "Job runs in background with SSE progress stream.",
          "Review rows as matched, review, or no_match; override bad matches manually.",
          "Export results as Excel, JSON, or TXT. Completed jobs with no-match rows feed Product Discovery.",
        ],
      },
      {
        title: "Data & API",
        items: [
          "Tables: matcher_jobs, matcher_job_results (large JSON per job).",
          "POST /api/matcher/run — start job.",
          "GET /api/matcher/jobs — list campaigns.",
          "GET /api/matcher/job/{id}/results — paginated results.",
          "POST /api/matcher/job/{id}/override — manual match.",
          "DELETE /api/matcher/job/{id} — requires separate admin delete password.",
        ],
      },
      {
        title: "Job statuses",
        content: "pending → running → completed | failed | stopped",
      },
    ],
  },
  {
    id: "enrichment",
    title: "Barcode Enrichment",
    summary: "Match uploaded barcodes to catalog products and write missing barcodes back to the live catalog.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/enrichment — list jobs, create new, open job detail.",
      },
      {
        title: "Workflow",
        items: [
          "Upload sheet with product names + barcodes (optional POS codes).",
          "POST /api/enrichment/detect-columns suggests column mapping.",
          "Run matching job; review matched, review, already_synced, no_match rows.",
          "Resolve review rows (barcode conflict or low confidence).",
          "Apply matched rows — writes barcodes to catalog_products and reloads index.",
        ],
      },
      {
        title: "Row statuses",
        content: "matched · review · no_match · already_synced",
        items: [
          "review + barcode_conflict = catalog product already has a different barcode.",
          "Apply only works when job is completed or stopped.",
        ],
      },
      {
        title: "Data",
        content: "Tables: enrichment_jobs, enrichment_job_results. Writes to catalog_products on apply.",
      },
    ],
  },
  {
    id: "discovery",
    title: "Product Discovery",
    summary:
      "Find products on external sources for rows that Match Sheet could not match, then import candidates into staging.",
    subsections: [
      {
        title: "Routes",
        content:
          "/dashboard/discovery/jobs — job list. /jobs/new — wizard. /jobs/[id] — results. /try — single-product test. /sources — source profiles.",
      },
      {
        title: "Workflow",
        items: [
          "Input: upload a sheet OR pull no_match rows from a completed Match Sheet job.",
          "Search configured source profiles (built-in Chefaa + custom domains).",
          "Classify rows: found, review, not_found.",
          "Resolve: accept, reject, or pick a candidate.",
          "Import accepted rows → catalog_products_staging (NOT live until Catalog Seeder promote).",
        ],
      },
      {
        title: "Source profiles",
        content: "Table: source_profiles. Managed under Discovery → Sources. chefaa.com is built-in and cannot be deleted.",
      },
      {
        title: "Data",
        content: "Tables: discovery_jobs, discovery_job_results. Import target: catalog_products_staging.",
      },
    ],
  },
  {
    id: "catalog",
    title: "Catalog Seeder",
    summary: "Refresh and promote the product catalog through a multi-step pipeline with a safety gate before going live.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/catalog",
      },
      {
        title: "Pipeline steps",
        items: [
          "crawl — fetch from Meilisearch (full refresh only).",
          "sync_staging — copy live catalog → staging.",
          "import — load JSON into staging.",
          "normalize — normalize names in staging.",
          "seed_mappings — seed brand mappings for the normalizer.",
          "promote — replace live catalog from staging (requires user confirmation).",
          "reload_index — reload in-memory matcher index.",
        ],
      },
      {
        title: "Default vs full refresh",
        content:
          "Default: sync_staging → normalize → seed_mappings → promote → reload_index. Full refresh adds crawl + import first.",
      },
      {
        title: "Important",
        items: [
          "Job pauses at awaiting_promotion until you confirm in the UI.",
          "Promote blocked if staging is empty.",
          "Tables: catalog_products (live), catalog_products_staging, catalog_pipeline_jobs.",
        ],
      },
    ],
  },
  {
    id: "browse",
    title: "Browse DB",
    summary: "Explore the live catalog: products, brands, and category taxonomy with search and export.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/browse — tabs: Products, Brands, Categories.",
      },
      {
        title: "Features",
        items: [
          "Paginated product list with grid/list view and detail modal.",
          "Deep link: ?productId= opens a product directly.",
          "Export wizard for catalog data and media.",
          "Reads from in-memory index (503 if index not loaded).",
        ],
      },
      {
        title: "API",
        content: "GET /db/products, /db/brands, /db/categories, /db/summary, /db/export/*",
      },
    ],
  },
  {
    id: "gallery",
    title: "Media Gallery",
    summary: "View and download locally cached product/brand images from CDN URLs in the catalog.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/gallery",
      },
      {
        title: "Workflow",
        items: [
          "Stats show catalog vs local image coverage.",
          "Fetch job downloads missing (or all) CDN images to data/media/.",
          "One fetch job at a time; SSE progress; stop supported.",
          "Images served at /media/{category}/{filename}.",
        ],
      },
    ],
  },
  {
    id: "search",
    title: "Global Search",
    summary: "Ad-hoc single-query fuzzy search against the catalog index — same scoring as Match Sheet.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/search",
      },
      {
        title: "API",
        content: "GET /match?q=&top=10&match_threshold=&review_threshold=",
      },
    ],
  },
  {
    id: "normalize",
    title: "Normalize",
    summary: "Interactive lab for the Arabic/English product name normalizer used by matching.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/normalize",
      },
      {
        title: "API",
        content: "GET /normalize?q= · POST /normalize/batch",
      },
      {
        title: "Data",
        content: "Reads brands, tokens, stop_words tables in pharmatcher.db.",
      },
    ],
  },
  {
    id: "crawler",
    title: "Campaign Crawler (optional)",
    summary:
      "Low-level Chefaa Meilisearch crawler. Hidden unless NEXT_PUBLIC_ENABLE_CRAWLER=true.",
    subsections: [
      {
        title: "Routes",
        content: "/dashboard/crawler — launch. /campaigns — history. /explorer — browse crawled products.",
      },
      {
        title: "Storage",
        content: "Separate DB: crawler_jobs.db. Output: data/crawler/jobs/{id}/results.json",
      },
      {
        title: "API",
        content: "POST /api/crawler/run · GET /api/crawler/jobs · SSE stream · download JSON/Excel",
      },
    ],
  },
  {
    id: "users",
    title: "User Management",
    summary: "Admin UI to create users, assign roles, toggle active status, and grant per-module permissions.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/admin/users",
      },
      {
        title: "Rules",
        items: [
          "Cannot deactivate or delete yourself.",
          "Cannot demote yourself from admin.",
          "Admins implicitly have all permissions.",
        ],
      },
      {
        title: "API",
        content: "GET/POST /api/auth/users · PATCH/DELETE /api/auth/users/{id}",
      },
    ],
  },
  {
    id: "database",
    title: "Database Settings",
    summary:
      "Backup, restore, and clean pharmatcher.db. All destructive actions require your account password.",
    subsections: [
      {
        title: "Route",
        content: "/dashboard/admin/database",
      },
      {
        title: "Clean Database Manager",
        items: [
          "Select tables to wipe row data (protected: users, schema_meta).",
          "Select All + Clean Selected replaces the old Clean All button.",
          "Job tables (matcher_jobs, discovery_jobs, etc.) are now in pharmatcher.db and can be cleaned here.",
          "VACUUM runs after clean to reclaim disk space.",
        ],
      },
      {
        title: "Export backup",
        items: [
          "Pick which tables to include — each shows estimated disk size.",
          "Large result tables (*_job_results) excluded by default to keep backups small.",
          "users + schema_meta always included.",
          "Download uses a short-lived token; browser streams the file natively.",
        ],
      },
      {
        title: "Import backup",
        items: [
          "Replaces entire pharmatcher.db from uploaded .db file.",
          "Must contain users and schema_meta tables.",
          "Reloads catalog index after import.",
        ],
      },
      {
        title: "API",
        content:
          "GET /api/db-admin/tables · POST /api/db-admin/clean · POST /api/db-admin/backup/export · GET /api/db-admin/backup/download · POST /api/db-admin/backup/import",
      },
    ],
  },
  {
    id: "workflow",
    title: "Typical Cross-Module Workflow",
    summary: "How the modules connect in a real pharmacy mapping pipeline.",
    bullets: [
      "1. Match Sheet — upload inventory, identify matched vs no_match rows.",
      "2. Product Discovery — search external sources for no_match rows, import to staging.",
      "3. Catalog Seeder — normalize staging data and promote to live catalog.",
      "4. Barcode Enrichment — backfill missing barcodes on live products.",
      "5. Media Gallery — cache product images locally.",
      "6. Browse DB / Global Search — explore the updated catalog.",
    ],
    code:
      "Match Sheet → (no_match) → Discovery → staging → Catalog Seeder promote → live catalog\n" +
      "Barcode Enrichment → apply → catalog_products → index reload\n" +
      "Database backup/export → pharmatcher.db (select tables) → import on another machine",
  },
  {
    id: "permissions-ref",
    title: "Permission Quick Reference",
    summary: "Which permission unlocks which area.",
    table: {
      headers: ["Permission", "Dashboard route", "API prefix"],
      rows: [
        ["matcher", "/dashboard/matcher", "/api/matcher, /match"],
        ["enrichment", "/dashboard/enrichment", "/api/enrichment"],
        ["discovery", "/dashboard/discovery/*", "/api/discovery, /api/sources"],
        ["catalog", "/dashboard/catalog", "/api/catalog"],
        ["crawler", "/dashboard/crawler/*", "/api/crawler"],
        ["browse", "/dashboard/browse", "/db/*"],
        ["gallery", "/dashboard/gallery", "/api/gallery"],
        ["search", "/dashboard/search", "GET /match"],
        ["normalize", "/dashboard/normalize", "/normalize"],
        ["users", "/dashboard/admin/*", "/api/auth/users, /api/db-admin"],
      ],
    },
  },
];

export const DEV_HELP_TOC = DEV_HELP_SECTIONS.map(({ id, title }) => ({ id, title }));
