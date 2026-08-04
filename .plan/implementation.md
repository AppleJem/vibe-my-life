# Implementation Phases

## Phase 1: Monorepo Scaffold

- [ ] Initialize git repo
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create root `package.json` with scripts
- [ ] Create `.gitignore`
- [ ] Scaffold Vite React+TS project in `frontend/`
- [ ] Install and configure TailwindCSS v4 in frontend
- [ ] Install TanStack Router + Vite plugin
- [ ] Configure `vite.config.ts` (TanStack plugin before React plugin)
- [ ] Create `backend/` with `package.json`, `tsconfig.json`
- [ ] Install backend dependencies
- [ ] Set up backend entry point (`index.ts`, `server.ts`)

## Phase 2: Backend Config

- [ ] Create `backend/.env.example`
- [ ] Create `config/env.ts` — Zod-validated env loading
- [ ] Create `config/db.ts` — DynamoDB DocumentClient init

## Phase 3: Backend Auth

- [ ] Create `auth/auth.types.d.ts`
- [ ] Create `auth/auth.service.ts` — credentials login + JWT
- [ ] Create `auth/auth.controller.ts` — login handler
- [ ] Create `auth/auth.routes.ts` — POST /api/auth/login
- [ ] Create `middleware/authMiddleware.ts`
- [ ] Create `middleware/errorHandler.ts`
- [ ] Wire up routes in `server.ts`

## Phase 4: Backend Expense CRUD

- [ ] Create `expense/expense.types.d.ts`
- [ ] Create `expense/expense.model.ts` — DynamoDB operations
- [ ] Create `expense/expense.controller.ts` — request handlers
- [ ] Create `expense/expense.routes.ts` — all CRUD routes
- [ ] Wire up in `server.ts`

## Phase 5: Frontend Login

- [ ] Create `services/api.ts` — Axios instance with interceptors
- [ ] Create `types/expense.d.ts`
- [ ] Create `routes/__root.tsx` — Root layout with `<Outlet />`
- [ ] Create `routes/login.tsx` — Login page route
- [ ] Create `routes/_authenticated.tsx` — Auth guard with `beforeLoad` redirect
- [ ] Create `components/Login/LoginForm.tsx`
- [ ] Create `main.tsx` with TanStack Router setup

## Phase 6: Frontend Dashboard

- [ ] Create `constants/categories.ts`
- [ ] Create `hooks/useExpenses.ts`
- [ ] Create `components/Layout.tsx`
- [ ] Create `routes/_authenticated/index.tsx` — Dashboard page
- [ ] Create `components/ExpenseTracker/MonthHeader.tsx`
- [ ] Create `components/ExpenseTracker/ExpenseList.tsx`
- [ ] Create `components/ExpenseTracker/ExpenseItem.tsx`
- [ ] Style with Tailwind dark candy pop colors (zinc, rose, cyan, violet, lime)

## Phase 7: Frontend Add Expense

- [ ] Create `AddExpenseModal/AddExpenseModal.tsx`
- [ ] Create `AddExpenseModal/DatePicker.tsx` — calendar grid
- [ ] Create `AddExpenseModal/Calculator.tsx` — expression builder
- [ ] Create `AddExpenseModal/CategoryPicker.tsx` — emoji grid
- [ ] Create `AddExpenseModal/NoteInput.tsx`
- [ ] Add FAB button to DashboardPage
- [ ] Wire up API calls for creating expense

## Phase 8: Swipe & Delete

- [ ] Create `SwipeContainer.tsx` — month navigation gestures
- [ ] Add swipe-to-delete to `ExpenseItem.tsx`
- [ ] Create confirm popup for deletion
- [ ] Add spring animations

## Phase 9: Polish

- [ ] Loading states (skeletons/spinners)
- [ ] Error handling (toast notifications)
- [ ] Empty states
- [ ] Transition animations
- [ ] Responsive tweaks
- [ ] Test all flows end-to-end

---

## Running the App

```bash
# Install dependencies
pnpm install

# Development (both frontend and backend)
pnpm dev

# Or individually
pnpm --filter frontend dev
pnpm --filter backend dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001
