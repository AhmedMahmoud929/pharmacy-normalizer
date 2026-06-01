---
title: How It Works Page Specification
version: 1.0
date_created: 2026-05-14
owner: Antigravity
tags: [design, app, frontend]
---

# Introduction

This specification defines the requirements and design for a new "How It Works" page in the PharmMatcher AI frontend. The page is intended to educate users on the technical mechanics of the "Turbo v8" matching engine, providing transparency into how inconsistent product names are normalized and mapped to the standard database.

## 1. Purpose & Scope

The "How It Works" page serves as a technical walkthrough for stakeholders and data operators. It explains the step-by-step transformation of a raw product name into a matched entity.

**Scope:**
- Visual representation of the matching pipeline.
- Detailed explanation of normalization, indexing, and scoring.
- Interactive or animated elements to demonstrate the "black box" logic.

## 2. Definitions

- **Turbo v8**: The current high-performance matching engine used in the backend.
- **Normalization**: The process of cleaning and standardizing text (e.g., "500mg" to "500 mg").
- **Weighted Jaccard**: A similarity metric that measures token overlap, giving more importance to critical tokens like brands and doses.
- **Sequence Matcher**: A metric that compares the literal character sequence of two strings.
- **Inverted Index**: A data structure that allows fast searching by mapping tokens to the products that contain them.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: The page must be accessible via the main navigation (e.g., `/how-it-works`).
- **REQ-002**: Use a "Step-by-Step" vertical or horizontal timeline layout.
- **REQ-003**: Include a "Live Demo" or "Interactive Example" section where users can type a query and see the real-time scoring breakdown.
- **REQ-004**: Implement SEO best practices (Title: "How It Works | PharmMatcher AI", Meta Description).
- **REQ-005**: Use the existing design system (Premium aesthetics, dark mode support, glassmorphism).
- **CON-001**: The page must be responsive and performant on mobile devices.
- **CON-002**: Explanations must be accessible to non-technical users while remaining accurate for developers.
- **GUD-001**: Use Mermaid diagrams or custom SVG animations to visualize data flow.

## 4. Interfaces & Data Contracts

The page will primarily use the following existing API endpoints:
- `GET /normalize?q=...`: To show the normalization step.
- `GET /match?q=...`: To show the scoring breakdown (requires backend to return detailed scoring metadata if not already present).

### Data Example for Interactive Demo:
```json
{
  "query": "بانادول ٥٠٠ مجم",
  "steps": [
    { "name": "Arabic Normalization", "output": "panadol 500 mg" },
    { "name": "Tokenization", "output": ["panadol", "500", "mg"] },
    { "name": "Scoring", "jaccard": 0.85, "sequence": 0.9, "final": 0.87 }
  ]
}
```

## 5. Acceptance Criteria

- **AC-001**: Given a user visits `/how-it-works`, When the page loads, Then they see a visually rich overview of the 5 key matching steps.
- **AC-002**: The "Scoring Breakdown" section correctly explains the 70/30 split between Jaccard and Sequence matching.
- **AC-003**: All interactive elements (hover effects on steps) are functional and smooth.

## 6. Test Automation Strategy

- **Unit Tests**: Verify the logic of the "Interactive Demo" state management.
- **E2E Tests**: Ensure the page is reachable and renders all sections correctly using Playwright.
- **Accessibility**: Run Lighthouse/Axe audits to ensure a score of 90+.

## 7. Rationale & Context

The "Turbo v8" engine is complex. Users often ask why a certain product matched or failed to match. By exposing the "unmatched_query" and "unmatched_db" logic visually, we empower users to improve their own data (e.g., adding missing brands to the mapper) rather than treating the AI as a black box.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Backend API - Requires access to the `/match` and `/normalize` endpoints.

### Infrastructure Dependencies
- **INF-001**: Next.js App Router - For page routing and server-side rendering.

## 9. Examples & Edge Cases

- **Edge Case: No Match Found**: The interactive demo should clearly show why a score fell below the 50% threshold.
- **Edge Case: Complex Arabic**: Show how "أوجمنتين" becomes "augmentin" through the normalization layer.

## 10. Validation Criteria

- The page matches the "Premium Aesthetics" of the existing dashboard.
- The technical details accurately reflect the logic in `backend/tools/matcher.py`.

## 11. Related Specifications / Further Reading

- [drug-matcher.md](file:///c:/Users/Alrba/OneDrive/Desktop/drug-mapping/backend/docs/specs/drug-matcher.md)
- [matcher.py](file:///c:/Users/Alrba/OneDrive/Desktop/drug-mapping/backend/tools/matcher.py)
