# Detailed Specification: Frontend UI/UX Enhancements (v9)

This document provides a granular breakdown of the features and tasks required to enhance the Drug Matcher frontend, including shared components, new pages, and advanced table interactions.

## 1. Shared Layout & Core Navigation
**Objective**: Establish a professional, persistent UI framework.

### 1.1 Navbar Component (`frontend/components/layout/Navbar.tsx`)
- **Branding**: Display "Softcount AI" with a Lucide `Activity` or `Table` icon.
- **Nav Items**:
  - `Home`: Link to `/`
  - `Match Sheet`: Link to `/dashboard/matcher`
  - `Browse DB`: Link to `/dashboard/browse`
  - `Search`: Link to `/dashboard/search`
  - `Normalize`: Link to `/dashboard/normalize`
- **Theme Switcher**: A sun/moon toggle to switch between `light` and `dark` modes (using Tailwind `dark:` classes).
- **Backend Health**: A small pulsing dot (green/red) indicating if the API is reachable.

### 1.2 Footer Component (`frontend/components/layout/Footer.tsx`)
- Simple centered layout with version number and copyright.
- Links to GitHub/Documentation.

---

## 2. Feature-Rich Home Page (`frontend/app/page.tsx`)
**Objective**: Create a central hub for all application capabilities.

### 2.1 Hero Section
- Large, bold typography: "Master Your Pharmacy Data."
- Sub-headline: "AI-powered normalization, high-performance matching, and database exploration."

### 2.2 Feature Cards (`FeatureCard` component)
Four interactive cards with hover animations using `framer-motion`:
1. **Browse Database**: "Explore the master product list, SKUs, and categories."
2. **Global Search**: "Lookup any product instantly using fuzzy matching."
3. **Normalization Tester**: "Debug how raw names are transformed into canonical forms."
4. **Batch Matcher**: "Process entire Excel/CSV files at multi-core speeds."

---

## 3. Advanced Matching Table Interactions
**Objective**: Move from "Read-Only" results to an "Active Auditing" workflow.

### 3.1 Table Action Column
Add an "Actions" column to the `DrugMatcher` results table.

#### A. Review Status Actions
- **Approve Button**: 
  - Icon: `Check`
  - Effect: Updates the row status to `matched` locally.
- **Reject Button**:
  - Icon: `X`
  - Effect: Opens a dropdown/menu with:
    - "Mark as No Match"
    - "Choose Manually" (Triggers Edit flow)

#### B. Matched/No-Match Actions
- **Edit Button**:
  - Icon: `Edit2`
  - Effect: Opens the **Manual Selection Modal**.

### 3.2 Manual Selection Modal (`ManualMatchModal.tsx`)
- **Input**: A search field that auto-focuses.
- **Search Logic**: Calls `/match?q={query}&top=10` on the backend.
- **Results**: Displays a list of cards for each candidate:
  - Product Name
  - SKU
  - Match Score (if applicable)
- **Selection**: Clicking a result replaces the `matches[0]` of the target row in the main table and sets status to `matched`.

---

## 4. Enhanced Exporting
**Objective**: Export data that is ready for production use or training.

### 4.1 "Production-Ready Storefront Export" (CSV/JSON)
A specialized export option that generates a final catalog file ready for consumption by a production store website.
- **Data Source**: Joins the matched results with the full product records from `backend/data-extractor/data/products.json`.
- **Fields**: Includes ALL canonical fields from the master database:
  - `id`, `sku`, `name_en`, `name_ar`, `slug`, `image`, `images` (JSON array), `price`, `discount_price`, `in_stock`, `stock`, `active`.
  - Full `category` object (including sub-categories).
  - Full `brand` object.
  - `product_variants` (nested array).
  - `need_prescription`, `share_link`.
- **Exclusions**: Removes all matching-related metadata (scores, status, tokens, diagnostic weights) to ensure a clean storefront-ready dataset.
- **Format**: 
  - **JSON**: A flat or nested array of full product objects.
  - **CSV**: A flattened version with prefixed columns for nested objects (e.g., `category_name`, `brand_name`).

---

## 5. Task Breakdown

### Phase 1: Foundation (Shared UI)
- [ ] Create `frontend/components/layout/Navbar.tsx` and `Footer.tsx`.
- [ ] Update `frontend/app/layout.tsx` to wrap `{children}` in a flex container with Navbar/Footer.
- [ ] Implement Light/Dark mode logic in `tailwind.config.ts` and `globals.css`.

### Phase 2: Home Page & Routing
- [ ] Build the new `app/page.tsx` with Hero and Feature Cards.
- [ ] Create placeholder routes/pages for `/dashboard/browse`, `/dashboard/search`, and `/dashboard/normalize`.
- [ ] Implement the Normalization Tester page (simple input -> API call -> display result).

### Phase 3: Interactive Matcher
- [ ] Modify `DrugMatcher.tsx` to add "Actions" column.
- [ ] Implement `handleApprove` and `handleReject` logic in `DrugMatcher` state.
- [ ] Create `frontend/components/ManualMatchModal.tsx` using `Radix UI` or `framer-motion`.
- [ ] Connect "Edit" button to open the modal and update the correct row result.

### Phase 4: Backend Support (Required for Full Export)
- [ ] Update `api.py` payloads to include full `product` and `variant` objects from `products.json`.
- [ ] Add `/normalize?q=...` endpoint to `api.py`.
- [ ] Add `/db/products?limit=50&offset=0` endpoint for the Browse feature.

### Phase 5: Advanced Export
- [ ] Update the `exportToCSV` function in `DrugMatcher.tsx` to support the "Matched Reference" format.
- [ ] Add a JSON export option.
