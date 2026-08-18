---
title: Interactive Crawler Config Panel UX & Validation Specification
version: 1.1.0
date_created: 2026-05-24
owner: Pharmacy Normalizer Engineering Team
tags: [design, frontend, crawler, ux]
---

# Introduction

The Chefaa Crawler Configuration Panel allows supervisors to customize store harvesting targets, languages, storefront scopes, page ranges, specs enrichment depths, and asset processing stages. Currently, the interface exposes independent options that can lead to contradictory execution parameters (e.g., trying to physically download images while executing a high-speed "Catalog Only" run which bypasses image URLs).

This specification (v1.1.0) extends the panel in two major ways:
1. **Reactive State Machine** — coordinate input dependencies, hide irrelevant knobs, auto-resolve conflicting switches, and display clear premium warning tooltips.
2. **Campaign Preset Selector** — a high-level, mode-first UI that lets supervisors pick a named operation intent (e.g. "Fetch all products" or "Fetch first N categories"), auto-populate every underlying parameter, and expose only the `n` numeric input(s) when the selected mode requires them.

---

## 1. Purpose & Scope

The purpose of this specification is to redesign the campaign parameters form in [page.tsx](file:///c:/Users/Alrba/OneDrive/Desktop/drug-mapping/frontend/app/dashboard/crawler/page.tsx) into a bulletproof interactive panel. 

### In Scope:
1. **Interactive State Machine**: Strict rule definitions governing when checkboxes, selectors, and range inputs are enabled or disabled.
2. **Conditional Visibility**: Dynamically collapsing/fading sections that are not relevant to the currently selected scraping target (e.g., hiding page limitations for Brands/Categories).
3. **Reactive Validation UX**: Smart auto-correct logic (e.g., checking "Download Media" automatically forces "Include Media" to active).
4. **Campaign Preset Selector**: A named preset system that collapses the entire advanced form behind a single intent-driven selection; exposes numeric `n` step-inputs only where the preset requires them.
5. **Backend API Contract Extension**: A new `preset` field and optional `preset_n` / `preset_pages` integer fields on the `CrawlRunRequest` payload so the API can transparently map preset intent to the correct CLI arguments without requiring the frontend to infer them.
6. **Premium Aesthetics**: Styling indicators using harmonized zinc color palettes, micro-transitions, dynamic badges, and visual feedback warnings.

---

## 2. Definitions

* **Catalog Harvest**: Phase 1 execution of product retrieval that extracts name, SKU, price, and primary metadata without deep details.
* **Dual-Stage Harvest**: Phase 1 catalog harvesting plus an immediate asynchronous local media download queue.
* **Deep specifications**: Sequential detailed scrapers that extract rich HTML summaries, detailed property tables, and alternative gallery images.
* **Stats Only**: A non-scraping mode that queries the local SQLite/Meilisearch index metadata for resource counts, bypassing any direct HTTP queries to Chefaa.
* **Campaign Preset**: A named, supervisor-facing operation intent that encapsulates a fixed combination of target, category scope, page range, and other CLI flags — reducing the advanced form to zero or one interactive numeric input(s).
* **n (Numeric Parameter)**: A positive integer supplied by the supervisor at runtime when the selected Campaign Preset requires a variable count (e.g. number of categories, number of pages). Only ever zero, one, or two `n` inputs are shown at the same time.
* **Preset Mode**: The `preset` identifier string sent from the frontend to the backend API, used by `compile_cli_args()` to derive the full set of CLI flags independently of the raw advanced-form fields.

---

## 3. Requirements, Constraints & Guidelines

The following rules define the reactive UI state machine.

### 3.1 Scraping Target Constraints
- **REQ-001**: If Scraping Target (`target`) is set to `brands`, `categories`, or `sub-categories`:
  - **CON-001**: Hide/Disable **Image Processing Strategy** selector (exclusive to products).
  - **CON-002**: Hide/Disable **Pages Range** selector.
  - **CON-003**: Hide/Disable **Category Scope / Custom Path** controls.
  - **CON-004**: Hide/Disable **Deep Specifications Scrape** switch.
  - **CON-005**: Hide/Disable **Concurrency Control** slider (since brand/category retrieval uses flat lists, thread limits are handled internally).
- **REQ-002**: If Scraping Target (`target`) is set to `products`:
  - **CON-006**: Hide/Disable **Include Media** switch (which is only used to scrape cover photos or logo urls for categories/brands index files).

### 3.2 Stats-Only Override Rules
- **REQ-003**: If **Stats Summary Only** (`statsOnly`) is toggled `true`:
  - **CON-007**: Immediately uncheck and disable **Deep Specifications Scrape** (`deep`).
  - **CON-008**: Immediately uncheck and disable **Download Media Files** (`download`).
  - **CON-009**: Immediately uncheck and disable **Include Media** (`includeMedia`).
  - **CON-010**: Hide/Disable **Image Processing Strategy** (`crawlMode`), **Pages Range** (`pages`), **Category Scope**, and the **Concurrency Slider**.
  - **GUD-001**: Display a premium visual warning notice in the disabled sections indicating: *"Stats Only retrieves index counts straight from local database caches. Real-time crawling is offline."*

### 3.3 Media Stage Incompatibility Resolver
- **REQ-004**: If `target === "products"` and **Image Processing Strategy** (`crawlMode`) is set to `"catalog"` (Catalog Harvest Only):
  - **CON-011**: Disable and uncheck **Download Media Files** (`download`).
  - **GUD-002**: Render an explicit warning badge next to the disabled checkbox: *"Requires Dual-Stage Image Processing mode."*
- **REQ-005**: If `target` is not `products` (i.e. `brands`, `categories`, or `sub-categories`):
  - **CON-012**: If **Include Media** (`includeMedia`) is checked, **Download Media Files** (`download`) is fully enabled.
  - **CON-013**: If **Include Media** (`includeMedia`) is unchecked, disable and uncheck **Download Media Files** (`download`).
  - **PAT-001**: Toggling **Download Media Files** (`download`) to `true` shall automatically toggle **Include Media** (`includeMedia`) to `true` (cascade active state).

### 3.4 Campaign Preset Selector Rules

#### 3.4.1 Available Presets

The panel exposes exactly **6 campaign presets** grouped into two tiers:

**Production Fetchers** (full-scope, no `n` inputs):

| Preset ID | Label | Resolved CLI Equivalent | n Inputs |
| :--- | :--- | :--- | :---: |
| `all-products` | Fetch all products | `--products all --pages all` | None |
| `all-brands` | Fetch all brands | `--brands` | None |
| `all-categories` | Fetch all categories | `--sub-categories` | None |

**Testing Fetchers** (partial-scope, require `n` inputs):

| Preset ID | Label | Resolved CLI Equivalent | n Inputs |
| :--- | :--- | :--- | :---: |
| `first-n-categories` | Fetch first `{n}` categories | `--products quick-{n}` *(dynamic)* | 1: category count |
| `n-pages-of-n-categories` | Fetch `{pages}` pages of `{categories}` categories | `--products quick-{n} --pages {pages}` *(dynamic)* | 2: pages count + category count |
| `resource-stats` | Fetch resources stats | `--stats-only` | None |

#### 3.4.2 Preset Selection Behavior
- **REQ-006**: When a Campaign Preset is selected, the full advanced parameter form (target, category scope, pages range, concurrency, crawl mode, language, country, switches) shall be **collapsed and hidden** behind the preset card.
- **REQ-007**: Only the `n` input(s) required by the selected preset shall be rendered below the preset selector, clearly labelled.
- **REQ-008**: When `first-n-categories` is selected, one numeric stepper labeled **"Number of categories"** shall be shown with a default of `5` and a minimum of `1`.
- **REQ-009**: When `n-pages-of-n-categories` is selected, two numeric steppers shall appear side-by-side:
  - **"Pages per category"** — default `1`, minimum `1`.
  - **"Number of categories"** — default `5`, minimum `1`.
- **REQ-010**: When any preset with no `n` inputs is selected (e.g. `all-products`, `all-brands`, `resource-stats`), no numeric steppers shall be rendered.
- **GUD-003**: Each preset card must render a one-line description of the estimated scope and approximate duration:
  - `all-products` → *"Crawls every product across all categories and subcategories. Expected: 20–60 min."*
  - `all-brands` → *"Fetches the full manufacturer brand index. Expected: < 1 min."*
  - `all-categories` → *"Fetches all main and nested category nodes. Expected: < 1 min."*
  - `first-n-categories` → *"Crawls page 1 of the first N major categories. Expected: ~N × 5–10s."*
  - `n-pages-of-n-categories` → *"Crawls up to P pages of the first N major categories. Expected: ~N × P × 5s."*
  - `resource-stats` → *"Reads index counters from the local database. Expected: < 2s."*
- **CON-014**: A supervisor may switch back to **Advanced Mode** via a clearly labeled toggle link (e.g. *"Switch to Advanced Configuration ↓"*) that re-expands the full parameter form.
- **CON-015**: Selecting a preset must NOT mutate the underlying advanced-form state values — they remain as-is so switching to Advanced Mode shows the last manually configured values.

#### 3.4.3 Backend API Contract Extension
- **REQ-011**: The `CrawlRunRequest` Pydantic model in `backend/tools/api.py` shall be extended with three new optional fields:
  ```python
  preset: Optional[str] = None          # One of the 6 preset IDs above, or None
  preset_n: Optional[int] = None        # Primary n value (category count)
  preset_pages: Optional[int] = None    # Secondary n value (pages per category)
  ```
- **REQ-012**: Inside `compile_cli_args()`, if `req.preset` is not `None`, the preset resolution block takes priority over the raw `target`/`category_href`/`pages` fields. The mapping is:
  ```
  "all-products"            → --products all --pages all
  "all-brands"              → --brands
  "all-categories"          → --sub-categories
  "first-n-categories"      → --products all --pages 1  (with category limit = preset_n)
  "n-pages-of-n-categories" → --products all --pages {preset_pages} (with category limit = preset_n)
  "resource-stats"          → --stats-only
  ```
- **REQ-013**: The Python crawler `main.py` must support a `--category-limit {n}` CLI argument that caps the number of parent categories crawled when resolving the full categories list (used by `first-n-categories` and `n-pages-of-n-categories` presets). This is equivalent to the existing `quick-5` behavior but generalized to any `n`.
- **CON-016**: If `req.preset` is `None`, `compile_cli_args()` must fall through to existing advanced-field logic unchanged (full backward compatibility).
- **CON-017**: Preset IDs are validated server-side against the known set of 6 values; an unknown `preset` value must return HTTP `422 Unprocessable Entity` with a descriptive error message.

---

## 4. State Dependency Matrix

The following table summarizes active controls for each Campaign target selection:

| Configuration Variable | Products (Catalog Only) | Products (Dual-Stage) | Brands / Categories (No Media) | Brands / Categories (With Media) | Stats Only (Active) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Image Strategy (`crawlMode`)** | Enabled (Catalog) | Enabled (Dual) | Hidden | Hidden | Hidden |
| **Category Scope (`categoryHref`)**| Enabled | Enabled | Hidden | Hidden | Hidden |
| **Pages Range (`pages`)** | Enabled | Enabled | Hidden | Hidden | Hidden |
| **Concurrency Slider (`workers`)** | Enabled | Enabled | Hidden | Hidden | Hidden |
| **Deep Specifications (`deep`)** | Enabled | Enabled | Hidden | Hidden | Disabled / Forced Off |
| **Include Media (`includeMedia`)** | Hidden | Hidden | Enabled (Off) | Enabled (On) | Disabled / Forced Off |
| **Download Media (`download`)** | **Forced Off / Disabled** | Enabled | **Forced Off / Disabled** | Enabled | Disabled / Forced Off |

### 4.2 Campaign Preset vs. Advanced Mode Matrix

| Preset ID | `target` resolved | `category_href` | `pages` | `stats_only` | Advanced form visible? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `all-products` | `products` | `all` | `all` | `false` | Hidden |
| `all-brands` | `brands` | — | — | `false` | Hidden |
| `all-categories` | `sub-categories` | — | — | `false` | Hidden |
| `first-n-categories` | `products` | `all` (limit=`n`) | `1` | `false` | Hidden (shows 1 stepper) |
| `n-pages-of-n-categories` | `products` | `all` (limit=`n`) | `preset_pages` | `false` | Hidden (shows 2 steppers) |
| `resource-stats` | — | — | — | `true` | Hidden |
| *(Advanced Mode)* | user-defined | user-defined | user-defined | user-defined | **Visible** |

---

## 5. UI/UX Interface Enhancements

### 5.1 Dynamic Collapsing Sections
We will use Framer Motion `<AnimatePresence>` wrappers to gracefully collapse, slide, and expand form sections when targets change. This reduces form height by up to 55% when running non-product or stats-only jobs, eliminating clutter.

### 5.2 Disabled State Micro-Styling
Rather than generic browser gray-out, disabled fields will use:
- Slate-zinc glassmorphic backdrops (`bg-zinc-950/20 border-zinc-900/60`).
- Text headers muted to `text-zinc-600`.
- An inline amber warning badge with a subtle pulsing ping animation when trying to choose an incompatible image processing setup.

### 5.3 Campaign Preset Selector UI

The Campaign Preset Selector replaces the current parameter form as the **default entry point** for the panel. Its layout is defined as follows:

#### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│  CAMPAIGN PRESET                          [Advanced ↓] │
│                                                     │
│  ● Production Fetchers                              │
│    ┌──────────────────┐ ┌──────────────────┐        │
│    │ ◉ Fetch All      │ │ ○ Fetch All      │ ...    │
│    │   Products       │ │   Brands         │        │
│    │ ~20–60 min       │ │ < 1 min          │        │
│    └──────────────────┘ └──────────────────┘        │
│                                                     │
│  ● Testing Fetchers                                 │
│    ┌──────────────────┐ ┌──────────────────┐ ...   │
│    │ ○ Fetch first N  │ │ ○ Fetch N pages  │        │
│    │   categories     │ │   of N categories│        │
│    │   [___5___]      │ │   [_1_] / [_5_]  │        │
│    └──────────────────┘ └──────────────────┘        │
│    ┌──────────────────┐                             │
│    │ ○ Resource Stats │                             │
│    │   < 2s           │                             │
│    └──────────────────┘                             │
└─────────────────────────────────────────────────────┘
```

#### Component Specifications
- **Preset Group Headings**: `text-[10px] uppercase tracking-widest text-zinc-500 font-bold` — used to separate production and testing preset groups visually.
- **Preset Cards**: `rounded-lg border bg-zinc-950/50 cursor-pointer` with `border-zinc-800` when unselected and `border-primary/60 bg-primary/5` ring glow when selected.
- **Active Card Indicator**: A small filled circle `●` (radio indicator) in top-left, primary color when active, zinc-700 when inactive.
- **Duration Badge**: `text-[9px] text-zinc-500` positioned at the bottom of each card.
- **`n` Steppers**: Compact inline `<Input type="number">` widgets rendered inside the selected card's lower region (not below it), styled `h-7 w-16 text-center bg-zinc-900 border-zinc-700 text-zinc-200` with `+` / `−` arrow buttons on either side.
- **Advanced Mode Toggle Link**: Rendered as `text-[10px] text-zinc-500 underline hover:text-zinc-300 cursor-pointer` in the panel's top-right corner, always visible.

---

## 6. Acceptance Criteria

**Advanced-Mode Validation**
- **AC-001**: Given a user selects "Products" as target, When "Image Processing Strategy" is set to "Phase 1: Catalog Harvest Only", Then the "Download Media Files" checkbox is disabled, unchecked, and displays a warning note.
- **AC-002**: Given a user checks the "Stats Summary Only" switch, When the form updates, Then the Pages, Concurrency, Crawl Mode, Deep Scrape, and Download Media controls are completely hidden, and a clean informational warning panel is shown.
- **AC-003**: Given a user selects "Brands" as target, When "Download Media Files" is enabled, Then "Include Media" is automatically toggled on as well.
- **AC-004**: Given any state transition (e.g. target change), When input choices are rendered, Then they fade and animate smoothly using standard cubic-bezier transitions.

**Campaign Preset Selector**
- **AC-005**: Given the panel first loads, When no preset has been previously selected, Then the Preset Selector is shown as the default view with no preset selected (all cards unselected / neutral style).
- **AC-006**: Given a user selects "Fetch all products" preset, When the card is clicked, Then it highlights with a primary-color glow, no `n` steppers appear, and clicking "Initiate Campaign" triggers the API with `preset = "all-products"`.
- **AC-007**: Given a user selects "Fetch first N categories", When the card is clicked, Then exactly one numeric stepper labeled "Number of categories" appears inside the card, defaulting to `5`.
- **AC-008**: Given a user selects "Fetch N pages of N categories", When the card is clicked, Then exactly two numeric steppers appear: "Pages per category" (default 1) and "Number of categories" (default 5), both with min of `1`.
- **AC-009**: Given a user selects "Fetch resources stats", When the card is clicked, Then no steppers appear and the description *"Reads index counters from the local database"* is shown.
- **AC-010**: Given a user clicks "Advanced ↓" toggle, When the form expands, Then all preset cards are hidden and the full parameter form is shown with its last manually configured values intact.
- **AC-011**: Given the backend receives `{ preset: "first-n-categories", preset_n: 3 }`, When `compile_cli_args()` executes, Then it emits `--products all --pages 1 --category-limit 3` flags (plus standard flags) and does NOT emit flags derived from the raw `target`/`category_href`/`pages` advanced fields.
- **AC-012**: Given the backend receives a `preset` value not in the allowed set of 6 IDs, When `compile_cli_args()` runs, Then the API returns `HTTP 422` with an error payload identifying the invalid preset.

---

## 7. Rationale & Context

Supervisors running the Pharmacy Normalizer crawler frequently need to trigger fast check-ups or complete overnight catalog syncing. Exposing independent parameters that are technically conflicting in the crawler script (`shefaa-crawler/main.py`) causes the crawler command to execute with meaningless flag combinations, resulting in false expectations or skipped operations.

By enforcing the state-dependency rules on the client-side form directly:
1. We eliminate user confusion and unnecessary support requests.
2. We prevent starting backend crawl subprocesses with conflicting parameters.
3. We provide instant visual context explaining *why* options are checked or locked.

---

## 8. Examples & Implementation Blueprint

### 8.1 UI Toggle Event Handler Blueprint (TypeScript React)
The following snippet demonstrates how state validations are consolidated in the component event loop:

```tsx
// Consolidate validation side effects inside a reactive hook or state effect
useEffect(() => {
  if (statsOnly) {
    setDeep(false);
    setDownload(false);
    setIncludeMedia(false);
    return;
  }

  // Handle target-specific constraints
  if (target === "products") {
    // If Catalog Harvest is active, physical downloading of images is impossible
    if (crawlMode === "catalog") {
      setDownload(false);
    }
  } else {
    // For Brands & Categories
    if (!includeMedia) {
      setDownload(false);
    }
  }
}, [target, statsOnly, crawlMode, includeMedia]);

// Handler helper to cascade state upgrades
const handleDownloadToggle = (checked: boolean) => {
  setDownload(checked);
  if (checked && target !== "products") {
    // Download requires includeMedia to fetch urls first
    setIncludeMedia(true);
  }
};
```

### 8.2 Premium Warning Badge CSS Component
```tsx
{/* Download Media Disabled Warning Badge */}
{target === "products" && crawlMode === "catalog" && (
  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse ml-2">
    <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
    Requires Dual-Stage Mode
  </span>
)}
```

### 8.3 Campaign Preset — Frontend State Shape

```tsx
// Preset state (null = Advanced Mode active)
type PresetId =
  | "all-products"
  | "all-brands"
  | "all-categories"
  | "first-n-categories"
  | "n-pages-of-n-categories"
  | "resource-stats"
  | null;

const [activePreset, setActivePreset] = useState<PresetId>(null);
const [presetN, setPresetN] = useState<number>(5);      // category count
const [presetPages, setPresetPages] = useState<number>(1); // pages count

// Preset payload builder — called inside handleStartCampaign
const buildPayload = () => {
  if (activePreset === null) {
    // Advanced mode — use raw form fields
    return { target, category_href: categoryHref, pages, ... };
  }
  return {
    preset: activePreset,
    preset_n: presetN,
    preset_pages: presetPages,
    // Always send storefront/language even in preset mode
    country,
    lang,
    localize: lang === "both",
    background: true,
    workers,
  };
};
```

### 8.4 Campaign Preset — Backend `compile_cli_args()` Extension

```python
VALID_PRESETS = {
    "all-products", "all-brands", "all-categories",
    "first-n-categories", "n-pages-of-n-categories", "resource-stats"
}

def compile_cli_args(req: CrawlRunRequest, job_id: str, root_path: str) -> List[str]:
    flags = []

    if req.preset:
        # --- Preset resolution block (takes full priority) ---
        if req.preset not in VALID_PRESETS:
            raise ValueError(f"Unknown preset id: '{req.preset}'")

        if req.preset == "all-products":
            flags.extend(["--products", "all", "--pages", "all"])

        elif req.preset == "all-brands":
            flags.append("--brands")

        elif req.preset == "all-categories":
            flags.append("--sub-categories")

        elif req.preset == "first-n-categories":
            n = req.preset_n or 5
            flags.extend(["--products", "all", "--pages", "1", "--category-limit", str(n)])

        elif req.preset == "n-pages-of-n-categories":
            n = req.preset_n or 5
            p = req.preset_pages or 1
            flags.extend(["--products", "all", "--pages", str(p), "--category-limit", str(n)])

        elif req.preset == "resource-stats":
            flags.append("--stats-only")

    else:
        # --- Existing advanced-field logic (unchanged) ---
        if req.target == "categories":
            flags.append("--categories")
        elif req.target == "sub-categories":
            flags.append("--sub-categories")
        # ... (rest of existing logic)

    # Common flags applied to both modes
    flags.extend(["--lang", req.lang or "en"])
    flags.extend(["--country", req.country or "eg"])
    if req.localize:
        flags.append("--localize")
    flags.extend(["--workers", str(req.workers or 4)])
    flags.extend(["--mode", "silent"])

    output_path = os.path.join(root_path, "backend", "data", "crawler",
                               "jobs", job_id, "results.json")
    flags.extend(["--output", output_path])
    return flags
```

---

## 9. Related Specifications
- [spec-architecture-shefaa-crawler-api.md](file:///c:/Users/Alrba/OneDrive/Desktop/drug-mapping/spec/spec-architecture-shefaa-crawler-api.md)
- [spec-architecture-decoupled-media-crawling.md](file:///c:/Users/Alrba/OneDrive/Desktop/drug-mapping/spec/spec-architecture-decoupled-media-crawling.md)
