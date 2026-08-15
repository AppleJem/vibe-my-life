# Expense Search Feature — Implementation Plan

## Overview
Add a search function to the expenses page that allows users to search expenses by text (matching `note` and `remarks` fields) within a specified month range.

---

## UI Design

### 1. Search Button Placement
- **Location**: Top nav bar in `Layout.tsx`, to the **left** of the existing menu (apps/settings) buttons
- **Icon**: Magnifying glass SVG icon
- **Behavior**: Toggles search mode on/off

### 2. Search Mode UI
When search is active:
- A **text input** appears directly below the sticky top nav bar (full width)
- Below the text input: **two month pickers** side by side (Start Month → End Month)
- The main expenses content area becomes **blank/empty** (ready to display results)
- Search results render in the **exact same format** as `ExpenseList` (grouped by date, with `ExpenseItem` components)

### 3. Month Picker Component
- Simple dropdown-style or native `<input type="month">` for selecting `YYYY-MM`
- Two pickers: "From" and "To" (inclusive range)
- Defaults: "From" = current month, "To" = current month

---

## Architecture

### New Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useExpenseSearch.ts` | Search hook: fetches multiple months, performs client-side filtering |
| `src/hooks/useDebounce.ts` | Generic debounce hook for the text input |
| `src/components/ExpenseTracker/SearchBar.tsx` | Search UI: text input + month range pickers |
| `src/components/ExpenseTracker/SearchResults.tsx` | Displays search results in ExpenseList format |
| `src/components/ExpenseTracker/MonthPicker.tsx` | Simple month selection component |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/Layout.tsx` | Add search button to header; accept `onSearchToggle` prop; render search bar slot below header when active |
| `src/routes/_authenticated/index.tsx` | Integrate search state, toggle, and conditional rendering (normal view vs search view) |

---

## Data Flow & Caching Strategy

### The Key Insight
The server only supports fetching by single month (`GET /expenses?month=YYYY-MM`). Search requires data across a month range. We reuse the **existing React Query cache** by fetching each month individually — the same keys used by normal browsing.

### `useExpenseSearch` Hook Logic

```
Input:  { enabled, startMonth, endMonth, query }
Output: { results, isSearching, loadedCount, totalCount }

1. Generate list of YYYY-MM strings from startMonth to endMonth (inclusive)
2. Split the month list into batches of 5
3. For each batch, issue parallel useQuery calls with key ['expenses', month] — same as useExpenses
   - Months already cached from normal browsing resolve instantly (no network hit)
   - New months are fetched in parallel, up to 5 at a time
   - As each batch completes, the next batch starts — progressive loading
4. Once all months are loaded, perform client-side filter:
   - Lowercase the search query
   - Filter expenses where `note` OR `remarks` contains the query (substring match)
5. Return filtered results sorted by date descending
```

### Batch Fetching Strategy
- **Batch size**: 5 months per parallel batch
- **Why batch**: Avoids hammering the server with dozens of simultaneous requests for large ranges
- **Progressive**: Results update as each batch completes — user sees partial results early
- **Cache-aware**: Already-cached months (from normal browsing) are included in the batch but resolve instantly from cache

### Debounce
- Text input is debounced at **300ms** before triggering the search filter
- Month range changes trigger immediate re-fetch (no debounce needed)

---

## Implementation Steps

### Step 1: Create `useDebounce` hook
- Simple hook that debounces a value with configurable delay
- Returns the debounced value

### Step 2: Create `MonthPicker` component
- Renders a native `<input type="month">` styled to match the app's dark theme
- Props: `value: string`, `onChange: (month: string) => void`, `label?: string`

### Step 3: Create `SearchBar` component
- Props: `query`, `startMonth`, `endMonth`, `onQueryChange`, `onStartMonthChange`, `onEndMonthChange`, `onClose`
- Layout: Close button + text input on one row, two month pickers on the next row
- Auto-focuses the text input on mount

### Step 4: Create `useExpenseSearch` hook
- Uses `useQueries` from React Query to fetch all months in the range
- Aggregates results, applies substring filter on debounced query
- Returns `{ results, isSearching, loadedCount, totalCount }`

### Step 5: Create `SearchResults` component
- Reuses the same rendering logic as `ExpenseList` (grouped by date, same styling)
- Shows loading skeleton while months are still fetching
- Shows "No results" message when query yields nothing

### Step 6: Modify `Layout.tsx`
- Add `showSearch` and `onSearchToggle` props
- Render search icon button in header (left of menu buttons)
- Render a `<div>` below the sticky header for the search bar slot (when `showSearch` is true)
- The slot renders children passed via a new `searchContent` prop or the SearchBar directly

### Step 7: Modify `index.tsx`
- Add search state: `isSearchOpen`, `searchQuery`, `startMonth`, `endMonth`
- Pass `isSearchOpen` / `onSearchToggle` to Layout
- When search is open:
  - Hide MonthHeader, SwipeContainer, ExpenseList/CategoryBreakdown
  - Show SearchBar + SearchResults in the content area
- When search is closed: restore normal view

---

## Visual Layout (Search Mode)

```
┌─────────────────────────────────────────────┐
│  Vibe My Life              🔍  📱  ⚙️      │  ← Header (sticky)
├─────────────────────────────────────────────┤
│  [ 🔍 Search expenses...              ✕ ]  │  ← Text input (debounced)
│  [ From: 2025-01 ]  [ To: 2026-08 ]        │  ← Month range pickers
├─────────────────────────────────────────────┤
│                                             │
│  2026-08-15                      -12.50     │  ← Search results (same
│  🍔 Lunch · "Team lunch at cafe"           │     format as ExpenseList)
│                                             │
│  2026-08-10                      -45.00     │
│  🛒 Groceries · "Weekly groceries"         │
│                                             │
│           (blank space below)               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Questions for Clarification

1. **When search mode is active, should the search bar stay fixed (sticky) while results scroll beneath it?** (I'm assuming yes — same as the header behavior)

2. **Should clicking a search result open the edit modal for that expense?** (I'm assuming yes — same as normal behavior)

3. **When the user closes search, should the normal month view restore to where it was before?** (I'm assuming yes)

4. ~~**Default month range**: Should both default to the current month, or should "From" default to something like 6 months ago?~~ → **Resolved**: Defaults to past 3 months (including current month)

---

Please review this plan and let me know if you'd like any adjustments before I begin implementation.
