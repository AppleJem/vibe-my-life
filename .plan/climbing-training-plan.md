# Climbing Training — plan

**Status:** ready to implement · **Scope:** `backend/src/modules/habit/*`,
`frontend/src/routes/_authenticated/{climbing,habits}/*`,
`frontend/src/components/{Climbing,Habits}/*`, `frontend/src/hooks/{useClimbing,useHabits}.ts`,
`frontend/src/services/api.ts`

> There is no training feature in the codebase today (grep for `training` finds only a
> comment in `ActionListEditor.tsx`). This plan builds it from scratch.

## What changes for the user

On `/climbing`, **below the `ActivityGrid`**:

```
… activity grid …

Training                                          [+]   ← opens /climbing/training + Add modal
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ 🧘   │ │ 📖   │ │ 🏃   │ │ 💧   │  …                 ← horizontally scrollable
│ Med  │ │ Read │ │ Run  │ │ Water│
└──────┘ └──────┘ └──────┘ └──────┘              [→]   ← opens /climbing/training (no modal)
```

- The **arrow** opens `/climbing/training`: a grouped, collapsible list of the habits
  **currently in training** (reusing `HabitList`).
- The **`+`** opens `/climbing/training` with the **Add modal** already open. The modal
  lists **all build habits** with a checkbox reflecting current membership; tapping toggles,
  **Confirm** applies both additions and removals.
- Tapping a box in the training strip opens that habit's page (`/habits/$habitId`).
- The habit page's back arrow returns to where you came from (climbing/training), not always
  to `/habits`.
- Strip order: habits **not done today** first; within every partition, **most recently
  clicked** first, tracked in localStorage. Done-today habits trail.

## Architecture — three surfaces

| Surface | Route | Shows | Tap a row | Training `+` |
| --- | --- | --- | --- | --- |
| Training strip | `/climbing` | habits in training | open the habit | `+` → training page **with modal** |
| Training page | `/climbing/training` | habits in training (grouped) | open the habit | its own `+` opens the modal |
| Add modal | overlay on the training page | **all** build habits | toggle membership | — |

Opening the modal uses route **state**, so a refresh never re-opens it:

```ts
navigate({ to: '/climbing/training', state: { add: true } })
```

`useLocation().state?.add` on the training page controls the modal. Closing clears the state
with a `replace` navigation.

## Confirmed decisions

| # | Decision |
| --- | --- |
| D1 | **Option A** — `training?: boolean` on the `Habit` item (see *Data model*). |
| D2 | Arrow and `+` both go to `/climbing/training`; `+` opens the Add modal on arrival. |
| D3 | In the Add modal, tapping toggles the selection; **Confirm** commits into training. |
| D4 | **Exclude `avoid` habits** from training entirely (list and strip). |
| D5 | Order by recency in **both** the not-done and done partitions. |
| D6 | Training section sits **below `ActivityGrid`** on `/climbing`. |
| D7 | **Exclude archived** habits from the strip and the selection surfaces. |
| Q1 | `/climbing/training` shows **only habits in training**, grouped. |
| Q2 | The Add modal shows **all build habits** and both **adds and removes** on Confirm. |
| Q3 | The training page has its **own `+`** to open the modal. |
| Q4 | Removal happens in the modal (answered by Q2). |
| Q5 | Route **state** opens the modal; refresh does not re-open it. |

**One smaller call I'm making unless told otherwise:** removing a habit from training also
clears its localStorage recency entry, so re-adding it starts fresh.

---

## Data model — Option A

Storage (habit table, same item as the habit):

```
PK = USER#<userId>
SK = META#<habitId>
{ ..., training: true }        // absent = not in training
```

Why it fits: the climbing section must load the habits anyway (name, emoji, done-today), and
`useHabits()` already serves the whole habit feature from one cached query, so the training
set is a pure client-side filter
(`habits.filter(h => h.training && polarityOf(h) === 'build')`). No new endpoint; deleting or
archiving a habit can never orphan a training entry. Trade-off: one toggle = one
`habitApi.update` write (parallelised for a multi-select), and "training" is a climbing word
on a generic habit.

Removal clears the attribute (`training: null`), matching the existing "absent means false"
convention used by `polarity`, `unit`, and `target`.

| File | Change |
| --- | --- |
| `backend/src/modules/habit/habit.types.d.ts` | `Habit.training?: boolean`; `CreateHabitInput.training?`; `UpdateHabitInput.training?: boolean \| null` |
| `backend/src/modules/habit/habit.controller.ts` | `training: z.boolean().nullable().optional()` in `updateHabitSchema`; `training: z.boolean().optional()` in `createHabitSchema` |
| `backend/src/modules/habit/habit.model.ts` | add `'training'` to `UPDATABLE`; spread it in `createHabit` |
| `frontend/src/types/habit.d.ts` | mirror the type fields |
| `frontend/src/services/api.ts` | nothing new — `habitApi.update` already sends `UpdateHabitInput` |

---

## Implementation phases

### Phase 0 — Decisions

- [x] D1–D7 and Q1–Q5 all confirmed (see table above)

### Phase 1 — Backend

- [x] `habit.types.d.ts`: `training` on `Habit`, `CreateHabitInput`, `UpdateHabitInput`
      (`boolean | null` on update)
- [x] `habit.controller.ts`: `training` in both zod schemas (`nullable()` on update)
- [x] `habit.model.ts`: `'training'` in `UPDATABLE`; spread in `createHabit`
- [x] `pnpm --filter backend build` passes

### Phase 2 — Client types, API, hooks

- [x] `frontend/src/types/habit.d.ts`: mirror the type fields
- [x] `useHabits.ts`: `useTrainingHabits()` returning `habits` (build/unarchived), `training`
      (in training), `groups`, and `applyTraining(selectedIds)` — a draft-to-diff mutation
      over `habitApi.update` that adds and removes in parallel with an optimistic list update
- [x] Confirmed the climbing page and training page update from cache invalidation alone
      (same `habitKeys.list()` key)

### Phase 3 — Training strip on `/climbing`

- [x] New `frontend/src/components/Climbing/TrainingSection.tsx`:
      header (`Training` + `+`), horizontal scrollable row of boxes, trailing arrow button
- [x] Box: emoji + name, done-today styling; click records recency then navigates to
      `/habits/$habitId`
- [x] `+` → `navigate({ to: '/climbing/training', state: { add: true } })`
- [x] Arrow → `navigate({ to: '/climbing/training' })`
- [x] Empty state ("No habits in training yet") + loading skeleton
- [x] Mount below `ActivityGrid` in `climbing/index.tsx`

### Phase 4 — `/climbing/training` page

- [x] New route `frontend/src/routes/_authenticated/climbing/training.tsx`
- [x] Renders `HabitList` with only the training habits, `groupHabits` for sections,
      `collapseKey="climbing:training:collapsedGroups"`
- [x] Header: back button + its own `+` that opens the Add modal
- [x] Reads `useLocation().state?.add` to mount the modal already open; a `replace`
      navigation clears the state so refresh/back does not re-open it
- [x] Empty state when nothing is in training

### Phase 5 — Add-habits modal

- [x] New `frontend/src/components/Climbing/AddTrainingHabitsModal.tsx`
- [x] Lists all **build, non-archived** habits via `useHabits()` + `groupHabits`
- [x] Extend `HabitList` with an optional selection mode (`selectedIds`, `onToggle`) so the
      modal reuses the grouped rows; default behaviour unchanged for habits/archived pages
- [x] Local draft `Set<string>` seeded from current membership once the list arrives
      (never seeded from empty); rows show checked state
- [x] Confirm applies add + remove through `applyTraining`, then closes the modal
- [x] Modal-specific `collapseKey="climbing:addHabits:collapsedGroups"`
- [x] Loading, empty, and write-error states; Cancel discards the draft

### Phase 6 — Habit page back button

- [x] In `habits/$habitId.tsx`, the top arrow now uses
      `router.history.canGoBack() ? router.history.back() : navigate({ to: '/habits' })`
- [x] Archive/delete success still goes to `/habits`
- [ ] Verify back from `/habits`, `/climbing` (box), `/climbing/training`; a deep link falls
      back to `/habits` *(manual)*

### Phase 7 — Ordering

- [x] `useLocalStorage<Record<string, number>>('climbing:training:recent', {})`
      (`habitId -> Date.now()`), written on box click
- [x] Pure `sortTrainingHabits()` helper in `utils/climbing.ts`: not-done before done; each
      partition by recency desc; name tiebreak; `today` from `localToday()`
- [x] A removed habit's recency entry is cleared on Confirm

### Phase 8 — Verification

- [ ] Add via modal → Confirm → strip updates without reload *(manual)*
- [ ] Remove via modal → Confirm → strip updates *(manual)*
- [ ] `+` opens `/climbing/training` with the modal; arrow opens it without *(manual)*
- [ ] Refresh on `/climbing/training` does **not** open the modal *(manual)*
- [ ] Avoid + archived habits never appear in the strip, training page, or modal *(manual)*
- [ ] Box → habit → back lands on `/climbing`, not `/habits` *(manual)*
- [ ] Log a training habit today → after returning it sorts to the end *(manual)*
- [ ] Click order survives a reload *(manual)*
- [x] `pnpm --filter frontend build` and `pnpm --filter backend build` pass
- [x] `npx tsc --noEmit` clean apart from a pre-existing `NodeJS` namespace error in the
      untouched `ImagePickerButton.tsx`

---

## Files touched

| File | Change |
| --- | --- |
| `backend/src/modules/habit/habit.types.d.ts` | `training` on `Habit` + inputs |
| `backend/src/modules/habit/habit.controller.ts` | `training` in both zod schemas |
| `backend/src/modules/habit/habit.model.ts` | `training` in `UPDATABLE` + create |
| `frontend/src/types/habit.d.ts` | mirror `training` |
| `frontend/src/hooks/useHabits.ts` | `useTrainingHabits`, `useSetTraining`/`applyTraining` |
| `frontend/src/utils/climbing.ts` | training-row order helper |
| `frontend/src/components/Climbing/TrainingSection.tsx` | new strip |
| `frontend/src/components/Climbing/AddTrainingHabitsModal.tsx` | new modal |
| `frontend/src/components/Habits/HabitList.tsx` | optional selection mode |
| `frontend/src/routes/_authenticated/climbing/index.tsx` | mount the section |
| `frontend/src/routes/_authenticated/climbing/training.tsx` | new page |
| `frontend/src/routes/_authenticated/habits/$habitId.tsx` | history-back button |
| `frontend/package.json` + `pnpm-lock.yaml` | added `@tanstack/history` so the route-state typing can augment `HistoryState` |
| `frontend/src/routeTree.gen.ts` | regenerated |
