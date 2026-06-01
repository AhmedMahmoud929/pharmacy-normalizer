---
title: Enhanced Export Dialog & Filtering System
version: 1.0
date_created: 2026-05-14
owner: Antigravity
tags: design, frontend, data-export
---

# Introduction

The current export functionality is limited to a simple dropdown menu with basic filtering by status. This specification outlines the transition to a comprehensive **Export Dialog** that provides granular control over export modes (Enhancement vs. Production) and advanced filtering capabilities to improve data quality and workflow efficiency.

## 1. Purpose & Scope

The purpose of this feature is to provide users with a robust interface to export matched drug data tailored for specific subsequent workflows:
- **AI Enhancement**: Exporting raw data with rich metrics for further AI analysis and issue detection.
- **Production Ready**: Exporting clean, full-product data (including media) for direct use in storefronts.
- **Granular Control**: Allowing users to filter results by status, confidence score, and other metadata before exporting.

The scope includes the frontend UI components (Dialog, Filters) and the client-side export logic.

## 2. Definitions

- **Enhancement Export**: A data-heavy export containing internal metrics (scores, token analysis) used to "feed" AI models or debug matching logic.
- **Production Export**: A clean export containing only customer-facing data (SKUs, Images, Names, Prices).
- **Match Score**: A float (0-1) representing the confidence of the match.
- **Jaccard/Sequence**: Specific similarity metrics used by the matching engine.

## 3. Requirements, Constraints & Guidelines

### UI/UX Requirements
- **REQ-001**: The export button shall open a modal/dialog instead of a dropdown.
- **REQ-002**: The dialog shall be split into two distinct sections: **Export for Enhancing** and **Export for Production**.
- **REQ-003**: Each section shall have a brief description explaining its use case.
- **REQ-004**: Implementation must use `framer-motion` for smooth entry/exit animations.
- **REQ-005**: Visual style must match the existing "Drug Matcher" premium aesthetic (glassmorphism, subtle gradients).

### Functional Requirements - Export Modes
- **MODE-001 (Enhancing)**: 
    - Fields: Row Index, Original Name, Normalized Name, Top Match Name, SKU, Status, Score, Jaccard, Sequence, Matched Tokens, Unmatched Tokens.
    - Purpose: Data gap analysis and AI fine-tuning.
- **MODE-002 (Production)**: 
    - Fields: ID, SKU, Name (EN/AR), Slug, Image URL, Price, Stock, Category, Brand, Prescription Requirement.
    - Purpose: Direct storefront ingestion.

### Filtering Requirements
- **FIL-001 (Status)**: Multi-select filter for `matched`, `review`, `no_match`.
- **FIL-002 (Score)**: Range slider or predefined buckets (e.g., Low <40%, Mid 40-70%, High >70%).
- **FIL-003 (Content)**: Filter by "Has Image" or "Has SKU".
- **FIL-004 (Selection)**: Option to export "Only Selected Rows" vs "All Filtered Results".

### Constraints
- **CON-001**: Export logic must remain client-side (using `xlsx` or `csv` libraries) to avoid server load for large datasets.
- **CON-002**: The dialog must be responsive and usable on mobile devices.

## 4. Interfaces & Data Contracts

### Export Schema: Enhancing Mode
| Field | Type | Description |
| :--- | :--- | :--- |
| `original_name` | string | The name from the uploaded file |
| `score` | float | Overall confidence score (0-1) |
| `jaccard` | float | Token similarity score |
| `unmatched_q` | string | Tokens in query not found in DB |

### Export Schema: Production Mode
| Field | Type | Description |
| :--- | :--- | :--- |
| `sku` | string | Unique identifier |
| `name_en` | string | English product name |
| `image` | string (URL) | Primary product image link |
| `active` | boolean | Product visibility status |

## 5. Acceptance Criteria

- **AC-001**: Given I have processed a file, When I click the Export button, Then a centered dialog with two columns/sections appears.
- **AC-002**: Given the Export Dialog is open, When I select "Export for Enhancing", Then the resulting CSV contains technical metrics like Jaccard and Sequence scores.
- **AC-003**: Given I set the Score filter to ">80%", When I export for Production, Then only rows with high confidence matches are included in the file.
- **AC-004**: Given I select "No Match" in the Status filter, When I export for Enhancing, Then I receive a file containing only the items that failed to match, helping me identify catalog gaps.

## 6. Rationale & Context

- **Why a Dialog?**: The current dropdown is too crowded and doesn't allow for complex filter configurations. A dialog provides the necessary real estate for a "wizard-like" export experience.
- **Why Two Sections?**: Users have different needs. A developer/data-scientist needs metrics to improve the model, while a catalog manager needs clean data to update the website. Mixing these fields in one file creates clutter.

## 7. Examples & Edge Cases

### Filtering Edge Case
If a user selects "Matched" status but sets the score filter to "0-20%", the export should reflect the intersection (which might be empty if thresholds are higher). A "No results found" warning should be shown within the dialog before they hit download.

### Data Volume
For files with >10,000 rows, the UI should show a "Generating..." loader on the download button to indicate processing.

## 8. Validation Criteria

- [ ] Dialog opens correctly with `framer-motion` animations.
- [ ] Export for Enhancing includes `matched_tokens` and `unmatched_query_tokens`.
- [ ] Export for Production includes image URLs and brand/category metadata.
- [ ] Filters (Status, Score) correctly prune the exported dataset.
