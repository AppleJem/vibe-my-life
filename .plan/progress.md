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
