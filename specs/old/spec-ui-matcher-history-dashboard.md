---
title: Drug Matcher History Dashboard & Routing Architecture
version: 1.0.0
date_created: 2026-06-02
owner: Antigravity AI
tags: [design, frontend, routing, spec]
---

# Introduction

This specification defines the structural UI/UX refactoring of the Drug Matcher frontend. Instead of defaulting the `/dashboard/matcher` route to the upload zone wizard, the default page will act as an enterprise campaign center, rendering a master table of past and active matching jobs. A prominent "New Match" action in the header will route users to a dedicated page `/dashboard/matcher/new` containing the core matcher wizard.

## 1. Purpose & Scope

The purpose of this refactor is to:
- Establish `/dashboard/matcher` as the primary historical logs hub.
- Move sheet uploads, active SSE progress monitors, and manual candidate override workflows to `/dashboard/matcher/new`.
- Support deep-linking and state rehydration via query parameters (e.g., `/dashboard/matcher/new?job_id=<uuid>`), making matching sessions completely shareable, bookmarkable, and reloadable.

---

## 2. Definitions

- **Campaign**: An execution cycle of a pharmacy drug matcher sheet.
- **Accuracy Rate**: The percentage of rows matching the `match` category (`matched_count / total_rows * 100`).
- **State Rehydration**: Loading local state variables from past results stored in SQLite and flat files on the server using a job ID.

---

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: The `/dashboard/matcher` default page must render a comprehensive, premium table of historical matching processes.
- **REQ-002**: The historical table must display:
  - Filename (with an excel/csv icon)
  - Date uploaded (formatted as human-friendly localized time)
  - Mapped Column Name
  - Process Status (`pending`, `running`, `completed`, `failed`)
  - Total Row Count
  - Matched Row Count & Review Count
  - Accuracy Rate (rendered as a vibrant colored tag or progress circle)
- **REQ-003**: The table actions must include:
  - **Inspect & Override**: Direct navigation to `/dashboard/matcher/new?job_id=<job_id>`, which automatically rehydrates the interactive candidate list.
  - **Export Sheet**: Trigger direct browser downloads of the compiled excel.
- **REQ-004**: The default page header must display a prominent button titled **"New Match"** routing to `/dashboard/matcher/new`.
- **REQ-005**: If `/dashboard/matcher/new` is loaded with a `job_id` search parameter, it must instantly call the backend API to fetch and rehydrate that session, transitioning straight to the results grid.

---

## 4. Interfaces & Data Contracts

### Next.js App Router Structure
```
frontend/
└── app/
    └── dashboard/
        └── matcher/
            ├── page.tsx          <-- [MODIFY] Campaign History Dashboard Table
            └── new/
                └── page.tsx      <-- [NEW] Core Upload Zone & Override Inspector
```

---

## 5. Acceptance Criteria

- **AC-001**: Given a user visits `/dashboard/matcher`, When they view the page, Then they see a table of historical campaigns fetched from the backend API.
- **AC-002**: Given a user clicks the "New Match" button, When the action triggers, Then they are redirected to `/dashboard/matcher/new` displaying the clean upload dropzone.
- **AC-003**: Given a user clicks "Inspect" on a completed campaign in the history table, When the router transitions to `/dashboard/matcher/new?job_id=<uuid>`, Then the session's reference columns, threshold values, and candidate results are fully rehydrated into view.

---

## 6. Rationale & Context

This design treats campaigns as first-class citizens. By moving the interactive work context into a sub-page with a query parameter, users gain the ability to bookmark completed mappings, refresh ongoing streams, and review past datasets easily. It avoids long-lived in-memory page states, resulting in a significantly more professional tool.

---

## 7. Related Specifications / Further Reading

- [spec-architecture-matcher-background-history.md](file:///a:/drug-mapping/specs/spec-architecture-matcher-background-history.md)
- [task.md](file:///C:/Users/Alrba/.gemini/antigravity/brain/508aeea8-596e-4d25-8511-f9fccd333ed8/task.md)
