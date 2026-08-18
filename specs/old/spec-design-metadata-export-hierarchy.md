---
title: Exporting Brands & Hierarchical Category Taxonomies with Interactive Tree Navigation
version: 1.0
date_created: 2026-06-02
owner: AhmedMahmoud929/pharmacy-normalizer-team
tags: [design, architecture, schema, frontend, backend]
---

# Introduction

This specification defines the architectural design, requirements, and data contracts to implement brand metadata exports (both data and media assets), multi-level hierarchical category navigation in the web browser, and customizable category data exports.

The catalog contains thousands of products grouped under hierarchical parent-child relationships (Level-1, Level-2, and Level-3 categories) and branded under distinct manufacturers. This document serves as the implementation blueprint to unify the export experience and introduce a highly refined, premium taxonomy exploration interface.

---

## 1. Purpose & Scope

The purpose is to expand catalog management capabilities by enabling:
- **Brand Metadata Export**: A 3-stage modal selection matching the Product Catalog export flow. Allows downloading structured brand information (Data) in `.xlsx`, `.json`, or `.txt` formats, or downloading compressed archives (Media) containing locally cached brand logo image files.
- **Hierarchical Category Tree View**: Redesign the browser category tab to render an interactive, nested accordion tree (Level-1 $\rightarrow$ Level-2 $\rightarrow$ Level-3) with premium micro-animations and live product count tallies.
- **Category Data-Only Export**: A wizard dialog that directly prompts for file format (`xlsx`, `json`, `txt`), defines range slicing bounds, and allows selecting specific hierarchical depth levels (Level 1, Level 2, and/or Level 3) for data extraction.

---

## 2. Definitions

- **L1 / L2 / L3 Categories**: Level 1 represent top-level classifications (e.g., "Medicines"). Level 2 are nested child subcategories (e.g., "Cardiovascular"). Level 3 are leaf-node subcategories (e.g., "Beta Blockers").
- **Metadata Export**: Automated parsing of memory-cached catalog indexes into flat sheets, raw JSON streams, or tab-delimited plain text files.
- **Media Asset**: Image files downloaded locally during crawling and cached inside `backend/data/media/brands` or `backend/data/media/products`.

---

## 3. Requirements, Constraints & Guidelines

### Requirements
- **REQ-BRN-01 (Data vs. Media)**: The Brand Export Dialog must prompt the user with two options:
  - **Data (Spreadsheet)**: Follows format selection (`xlsx`, `json`, `txt`) $\rightarrow$ Slicing config $\rightarrow$ Attribute checklist $\rightarrow$ Streams brand data rows.
  - **Media (ZIP)**: Requests compressed package containing locally stored manufacturer/brand logo assets.
- **REQ-CAT-01 (Direct Extension)**: The Category Export Dialog must skip the "Data vs Media" prompt and present the file extension selection (`xlsx`, `json`, `txt`) on step 1.
- **REQ-CAT-02 (Scope & Slicing)**: After format selection, Category Export must ask if the user wants the "Entire taxonomy" or a "Slice range" (configurable via `offset` and `limit`).
- **REQ-CAT-03 (Level Slicing Filter)**: The Category Export Dialog must contain a checklist allowing the user to select which taxonomy levels to include: `Level 1`, `Level 2`, and/or `Level 3`.
- **REQ-UI-CAT-Tree**: The Category browse tab must render only L1 (top-level) items initially. Clicking an L1 item expands a nested list displaying its internal L2 subcategories. Clicking an L2 item expands a nested list showing L3 subcategories.
- **REQ-UI-Aesthetics**: Tree expansion must feel responsive and organic, styled with modern typography, glassmorphism highlights, distinct left indentation lines for sub-levels, and smooth micro-animations.

### Constraints
- **CON-01 (Backward Compatibility)**: Existing endpoints like `/db/categories` must remain fully intact to prevent breaking current crawler dashboard utilities. New interfaces must use dedicated hierarchical paths or optional queries.
- **CON-02 (Performance)**: Slicing and hierarchical filtering must occur efficiently on the server side to minimize memory footprint during massive spreadsheet creation.

---

## 4. Interfaces & Data Contracts

### 4.1 Backend APIs (FastAPI)

#### A. Fetch Categories Tree Hierarchy
Returns the complete nested taxonomy tree mapped with product counts.

- **Endpoint**: `/db/categories/taxonomy`
- **Method**: `GET`
- **Response Format**: `application/json`
- **Schema**:
```json
[
  {
    "name": "Medicines",
    "slug": "medicines",
    "level": 1,
    "parent_slug": null,
    "count": 1502,
    "children": [
      {
        "name": "Cardiovascular Drugs",
        "slug": "cardiovascular-drugs",
        "level": 2,
        "parent_slug": "medicines",
        "count": 340,
        "children": [
          {
            "name": "Beta Blockers",
            "slug": "beta-blockers",
            "level": 3,
            "parent_slug": "cardiovascular-drugs",
            "count": 87,
            "children": []
          }
        ]
      }
    ]
  }
]
```

#### B. Brand Export Endpoint
Generates and streams structured brand records.

- **Endpoint**: `/db/export/brands`
- **Method**: `GET`
- **Parameters**:
  - `format` (Query, Required): `xlsx` | `json` | `txt`
  - `scope` (Query, Required): `all` | `slice`
  - `offset` (Query, Optional): `int` (default: 0)
  - `limit` (Query, Optional): `int` (default: 100)
  - `columns` (Query, Optional): Comma-separated list of attributes (e.g., `id,name_en,name_ar,slug,logo_url,count,local_image_url`)
- **Response**: Streaming file transfer with header `Content-Disposition: attachment; filename="chefaa_brands_export.[format]"`

#### C. Category Export Endpoint
Generates and streams taxonomy datasets filtered by active levels.

- **Endpoint**: `/db/export/categories`
- **Method**: `GET`
- **Parameters**:
  - `format` (Query, Required): `xlsx` | `json` | `txt`
  - `scope` (Query, Required): `all` | `slice`
  - `offset` (Query, Optional): `int` (default: 0)
  - `limit` (Query, Optional): `int` (default: 100)
  - `levels` (Query, Optional): Comma-separated levels to export (e.g., `1,2` or `1,2,3`)
- **Response**: Streaming file transfer with header `Content-Disposition: attachment; filename="chefaa_categories_export.[format]"`

---

## 5. Acceptance Criteria

- **AC-001 (Brand Export Data Path)**:
  - **Given** the user triggers the brand export wizard,
  - **When** the user selects "Data" as the export type,
  - **Then** the dialog prompts them for format selection (`xlsx`, `json`, `txt`), slicing ranges, and column checklist before triggering the download file.
  
- **AC-002 (Brand Export Media Path)**:
  - **Given** the user triggers the brand export wizard,
  - **When** the user selects "Media" as the export type,
  - **Then** the backend packages all local brand logo files matching the current catalog into a ZIP archive and triggers the browser download.

- **AC-003 (Category Export Direct Format)**:
  - **Given** the user clicks "Export" on the categories tab,
  - **When** the dialog renders,
  - **Then** it skips data vs media selection and directly presents options for `xlsx`, `json`, or `txt` extensions.

- **AC-004 (Category Level Filters)**:
  - **Given** the user is configuring category export scope,
  - **When** the level checkmarks are selected (e.g. only Level 1 and Level 2),
  - **Then** the generated spreadsheet lists only categories that fall under Level-1 and Level-2 depths, omitting Level-3 leaf entries.

- **AC-005 (Interactive Collapsible Tree Navigation)**:
  - **Given** the user is browsing the "Categories" tab in the Database Browser,
  - **When** the user clicks a Level-1 category,
  - **Then** a clean container slides open underneath via HSL-accented transitions showing Level-2 children, and clicking a Level-2 item exposes Level-3 children respectively.

---

## 6. Test Automation Strategy

- **Unit Testing**:
  - Assert backend extraction logics: Verify `ProductIndex` builds hierarchical trees containing Level 1, 2, and 3 entries with accurate cumulative parent product counts.
  - Verify Excel (`xlsx`), tab-delimited text (`txt`), and JSON outputs are properly structured.
- **Frontend Playwright Tests**:
  - Test accordion tree expanding: Click on a Level 1 tree element, wait for expansion transition, assert children Level 2 links are visible.
  - Form validation: Trigger category export dialog, verify media selection is omitted, select specific levels, check output API request parameters.

---

## 7. Rationale & Context

- **Why skip data/media for categories?** Categories represent abstract classification nodes rather than physical assets. They do not possess dedicated media logs, making media export options redundant.
- **Why collapsible tree navigation?** Displaying flat grids of thousands of category sub-nodes results in severe layout bloat and cognitive fatigue. Collapsible trees provide an elegant, structured taxonomy drilldown matching high-end storefront navigation.

---

## 8. Dependencies & External Integrations

### Data Dependencies
- **DAT-001 (chefaa_products_eg_normalized.json)**: The master Reference Index containing product records mapped with `level_one_category`, `level_two_category`, and `level_three_category` arrays.

### Technology Platform Dependencies
- **PLT-001 (Framer Motion)**: Used on the frontend to manage smooth transitions, layout shifts, and scale-up accordions during tree traversal.
- **PLT-002 (XLSX / openpyxl)**: Client-side and server-side engine libraries utilized to compile memory sheets into native binary spreadsheets.

---

## 9. Code & Architecture Drafts

### 9.1 Backend Extraction Reference Logic (FastAPI)
The following snippet drafts the taxonomy extraction logic from the reference dictionary:

```python
@app.get("/db/categories/taxonomy")
async def get_categories_taxonomy():
    if index is None:
        raise HTTPException(status_code=503, detail="Database not loaded")
    
    # 1. Structure raw tree mapping
    tree = {}
    
    # In-memory retrieval of entries
    for entry in index.entries:
        prod = entry["product"]
        
        # Level 1 Node
        l1 = prod.get("level_one_category")
        l1_slug = None
        if l1 and isinstance(l1, dict):
            l1_slug = l1.get("slug")
            if l1_slug and l1_slug not in tree:
                tree[l1_slug] = {
                    "name": l1.get("title_en") or l1.get("title_ar"),
                    "slug": l1_slug,
                    "level": 1,
                    "parent_slug": None,
                    "count": 0,
                    "children": {}
                }
            if l1_slug:
                tree[l1_slug]["count"] += 1

        # Level 2 Node
        l2_list = prod.get("level_two_category") or []
        if isinstance(l2_list, dict):
            l2_list = [l2_list]
            
        for l2 in l2_list:
            if l2 and isinstance(l2, dict):
                l2_slug = l2.get("slug")
                if l1_slug and l2_slug:
                    # Initialize child if not present
                    if l2_slug not in tree[l1_slug]["children"]:
                        tree[l1_slug]["children"][l2_slug] = {
                            "name": l2.get("title_en") or l2.get("title_ar"),
                            "slug": l2_slug,
                            "level": 2,
                            "parent_slug": l1_slug,
                            "count": 0,
                            "children": {}
                        }
                    tree[l1_slug]["children"][l2_slug]["count"] += 1
                
                # Level 3 Node
                l3_list = prod.get("level_three_category") or []
                if isinstance(l3_list, dict):
                    l3_list = [l3_list]
                    
                for l3 in l3_list:
                    if l3 and isinstance(l3, dict):
                        l3_slug = l3.get("slug")
                        if l1_slug and l2_slug and l3_slug:
                            if l3_slug not in tree[l1_slug]["children"][l2_slug]["children"]:
                                tree[l1_slug]["children"][l2_slug]["children"][l3_slug] = {
                                    "name": l3.get("title_en") or l3.get("title_ar"),
                                    "slug": l3_slug,
                                    "level": 3,
                                    "parent_slug": l2_slug,
                                    "count": 0
                                }
                            tree[l1_slug]["children"][l2_slug]["children"][l3_slug]["count"] += 1

    # 2. Format nested dictionaries into ordered arrays
    formatted_tree = []
    for l1_node in sorted(tree.values(), key=lambda x: x["count"], reverse=True):
        l1_copy = l1_node.copy()
        l2_nodes = []
        for l2_node in sorted(l1_node["children"].values(), key=lambda x: x["count"], reverse=True):
            l2_copy = l2_node.copy()
            l3_nodes = sorted(l2_node["children"].values(), key=lambda x: x["count"], reverse=True)
            l2_copy["children"] = l3_nodes
            l2_nodes.append(l2_copy)
        l1_copy["children"] = l2_nodes
        formatted_tree.append(l1_copy)
        
    return formatted_tree
```

### 9.2 Frontend Accordion Element Draft (TSX + Tailwind CSS)
Below is a concept implementation of the visual tree drilldown:

```tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FolderOpen, Layers } from "lucide-react";

interface CategoryNode {
  name: string;
  slug: string;
  level: number;
  count: number;
  children?: CategoryNode[];
}

export const CategoryTreeItem: React.FC<{ node: CategoryNode }> = ({ node }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="w-full select-none">
      {/* Clickable Header Bar */}
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        className={`flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer border ${
          isOpen
            ? "bg-primary/5 border-primary/20 text-primary"
            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isOpen ? "bg-primary/10 text-primary" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{node.name}</span>
            <span className="ml-2 text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-zinc-500 font-extrabold">
              Level {node.level}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-extrabold">{node.count} products</span>
          {hasChildren && (
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Accordion Sub-nodes Panel */}
      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="pl-6 ml-6 border-l border-zinc-200 dark:border-zinc-800 mt-2 space-y-2 overflow-hidden"
          >
            {node.children?.map((child) => (
              <CategoryTreeItem key={child.slug} node={child} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 10. Validation Criteria

Compliance with this specification requires:
1. **Interactive Expanding**: Clicking any Level-1 node renders Level-2 options with smooth Framer Motion height changes. Level-2 expandable nodes display Level-3 subcategories.
2. **Dynamic Level Filtering**: Exporting Level-2 only filters categories correctly dynamically inside `/db/export/categories` parameters.
3. **Format Integrity**: Exported `.xlsx`, `.json`, and `.txt` files containing brand and category tables conform to clean tabular schema configurations (UTF-8 format).

---

## 11. Related Specifications / Further Reading

- [Browse Tab Layout Specification](file:///a:/drug-mapping/frontend/app/dashboard/browse/page.tsx)
- [Catalog Export Wizards](file:///a:/drug-mapping/frontend/components/matcher/ExportWizardModal.tsx)
