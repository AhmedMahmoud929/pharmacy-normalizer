# Refactor Drug Matcher Layout Specification

## 1. Overview
This refactor aims to improve the User Experience (UX) of the Drug Matcher by maximizing screen real estate during the matching process and adding essential controls.

## 2. UI/UX Changes

### 2.1 Dynamic Layout
- **Initial State**: Show the upload zone and configuration panel on the left (current 1/3 layout).
- **Processing State**: Hide the left configuration panel to give more space to results.
- **Split Screen**: Transition to a split screen where the **Live Ticker** and **Matching Results Table** are side-by-side on the same row.

### 2.2 Process Controls
- **Stop/Cancel Button**: Add a visible "Stop Matching" button when `isProcessing` is true. This button will abort the active fetch request and stop the stream.

### 2.3 Advanced Table Functionality
- **Filtering**: Add a search bar to filter results by product name or status.
- **Sorting**: Allow sorting by Row Index, Score, or Status.
- **Consistency**: Maintain the Kraken design system (colors, borders, fonts).

## 3. Technical Requirements
- Use `AbortController` to handle stream cancellation.
- Use `useMemo` for filtering and sorting the `results` array to maintain performance.
- Update Framer Motion animations for smooth layout transitions.
