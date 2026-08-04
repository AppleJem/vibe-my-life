# Implementation Progress

## Phase 1: Monorepo Scaffold
- [x] Initialize git repo
- [x] Create `pnpm-workspace.yaml`
- [x] Create root `package.json` with scripts
- [x] Create `.gitignore`
- [x] Scaffold Vite React+TS project in `frontend/`
- [x] Install and configure TailwindCSS v4 in frontend
- [x] Install TanStack Router + Vite plugin
- [x] Configure `vite.config.ts` (TanStack plugin before React plugin)
- [x] Create `backend/` with `package.json`, `tsconfig.json`
- [x] Install backend dependencies
- [x] Set up backend entry point (`index.ts`, `server.ts`)

## Phase 2: Backend Config
- [x] Create `backend/.env.example`
- [x] Create `config/env.ts` — Zod-validated env loading
- [x] Create `config/db.ts` — DynamoDB DocumentClient init

## Phase 3: Backend Auth
- [x] Create `auth/auth.types.d.ts`
- [x] Create `auth/auth.service.ts` — credentials login + JWT
- [x] Create `auth/auth.controller.ts` — login handler
- [x] Create `auth/auth.routes.ts` — POST /api/auth/login
- [x] Create `middleware/authMiddleware.ts`
- [x] Create `middleware/errorHandler.ts`
- [x] Wire up routes in `server.ts`

## Phase 4: Backend Expense CRUD
- [x] Create `expense/expense.types.d.ts`
- [x] Create `expense/expense.model.ts` — DynamoDB operations
- [x] Create `expense/expense.controller.ts` — request handlers
- [x] Create `expense/expense.routes.ts` — all CRUD routes
- [x] Wire up in `server.ts`

## Phase 5: Frontend Login
- [x] Create `services/api.ts` — Axios instance with interceptors
- [x] Create `types/expense.d.ts`
- [x] Create `routes/__root.tsx` — Root layout with `<Outlet />`
- [x] Create `routes/login.tsx` — Login page route
- [x] Create `routes/_authenticated.tsx` — Auth guard with `beforeLoad` redirect
- [x] Create `components/Login/LoginForm.tsx`
- [x] Create `main.tsx` with TanStack Router setup

## Phase 6: Frontend Dashboard
- [x] Create `constants/categories.ts`
- [x] Create `hooks/useExpenses.ts`
- [x] Create `components/Layout.tsx`
- [x] Create `routes/_authenticated/index.tsx` — Dashboard page
- [x] Create `components/ExpenseTracker/MonthHeader.tsx`
- [x] Create `components/ExpenseTracker/ExpenseList.tsx`
- [x] Create `components/ExpenseTracker/ExpenseItem.tsx`
- [x] Style with Tailwind dark candy pop colors (zinc, rose, cyan, violet, lime)

## Phase 7: Frontend Add Expense
- [x] Create `AddExpenseModal/AddExpenseModal.tsx`
- [x] Create `AddExpenseModal/DatePicker.tsx` — calendar grid
- [x] Create `AddExpenseModal/Calculator.tsx` — expression builder
- [x] Create `AddExpenseModal/CategoryPicker.tsx` — emoji grid
- [x] Create `AddExpenseModal/NoteInput.tsx`
- [x] Add FAB button to DashboardPage
- [x] Wire up API calls for creating expense

## Phase 8: Swipe & Delete
- [x] Create `SwipeContainer.tsx` — month navigation gestures
- [x] Add swipe-to-delete to `ExpenseItem.tsx`
- [x] Create confirm popup for deletion
- [x] Add spring animations

## Phase 9: Polish
- [x] Loading states (skeletons/spinners)
- [x] Error handling (toast notifications)
- [x] Empty states
- [x] Transition animations
- [x] Responsive tweaks
- [ ] Test all flows end-to-end

## Phase 10: Multi-currency
- [x] Add `baseCurrency` / `currency` / `originalAmount` / `rate` to the `Expense` type (backend + frontend mirrors)
- [x] Extend expense zod schemas; `null` on the foreign fields clears them
- [x] Rework `expenseModel.update` to emit `SET` **and** `REMOVE` clauses
- [x] Add `baseCurrency` / `currencies` to `ExpenseMetadata`
- [x] Replace `metadataModel.put` with a partial `patch` so slices can't clobber each other
- [x] Add `PUT /api/metadata/currency`
- [x] Create `constants/currencies.ts` — symbols + per-currency decimal places
- [x] Create `utils/currency.ts` — `formatAmount`, `toBase`, `formatRate` (directional)
- [x] Create `services/rates.ts` — open.er-api.com fetch, 1-day localStorage cache
- [x] Merge `CategoriesContext` into `MetadataContext` (one metadata fetch, two hooks)
- [x] Create `routes/_authenticated/settings/currency.tsx`
- [x] Add currency selector to `AddExpenseModal`; last-used currency persists in localStorage
- [x] Route all five hardcoded `¥`/`$` sites through `formatAmount`
- [x] Two-line display in `ExpenseItem` (base amount, foreign amount below)
- [ ] Walk the UI flows manually (settings page, foreign entry, edit, offline)

## Phase 11: Import backup
- [x] Add `exceljs` + `multer` to the backend
- [x] Create `import/import.parser.ts` — pure Buffer → rows, headers resolved by name
- [x] Preserve the time-of-day the source file hides behind a `dd/MM/yyyy` cell format
- [x] Skip transfer rows; drop the two `Accounts` columns (income rows import as of Phase 12)
- [x] Join `Note` + `Description` so neither is lost
- [x] Keep zero-amount rows (refunds, vouchers) rather than treating them as invalid
- [x] Add `expenseModel.createMany` — `BatchWriteCommand`, 25/chunk, retries `UnprocessedItems`
- [x] Add `ImportExpenseInput` so an imported row keeps its original `createdAt`
- [x] Add `POST /api/import/analyze` — preview + proposed category mapping, writes nothing
- [x] Add `POST /api/import/commit` — re-parses the file and applies the confirmed mapping
- [x] Emoji-insensitive category suggestions ("🚖 Transport" → the existing "🚗 Transport")
- [x] Skip duplicates on `date + amount + note` so re-importing is a no-op
- [x] Create `routes/_authenticated/settings/import.tsx` — pick → review/map → result
- [x] Add `refreshMetadata` to `MetadataContext` so imported categories appear immediately
- [x] Add "Import backup" row to the settings page
- [x] `backend/scripts/check-import.ts` — parser cross-check against a real export
- [ ] Run a real import end-to-end against the live table

## Phase 12: Income
- [x] Add `type: 'expense' | 'income'` to the expense item; absent reads as `expense`
- [x] Keep the `EXPENSE#` sort-key prefix so one month query still returns everything
- [x] Scope `expenseModel.renameCategory` by type — names collide across the two lists
- [x] Add `incomeCategories` to metadata, defaulting at read time for pre-income users
- [x] `PUT /metadata/categories` takes both lists + both rename sets, patched independently
- [x] Import income rows instead of skipping them; fold the kind into mapping + dedupe keys
- [x] Shared `components/TypeToggle.tsx` — pill switcher used in 3 places
- [x] `utils/transaction.ts` — the one home for the absent-type-means-expense rule
- [x] MonthHeader shows In / Out / Net; ExpenseList day subtotals become nets
- [x] ExpenseItem renders income with `+` and `lime-400`
- [x] CategoryBreakdown gets its own expense/income switch (never one mixed donut)
- [x] AddExpenseModal parameterised by type — toggle, accent, copy, category source
- [x] Categories settings page gains an expense/income tab over two drafts, one save
- [ ] Walk the flows manually against the live table (see the plan's verification list)
