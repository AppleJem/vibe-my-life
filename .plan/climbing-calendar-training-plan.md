# Activity calendar — training overlay

**Status:** implemented · **Scope:** `frontend/src/utils/climbing.ts`,
`frontend/src/components/Climbing/ActivityGrid.tsx`,
`frontend/src/routes/_authenticated/climbing/index.tsx`,
`frontend/src/hooks/useHabits.ts`

## What changes for the user

The climbing page's activity calendar now shows training as well as climbing:

| Day has | Hue |
| --- | --- |
| climbing only | **blue** (sky) |
| training only | **green** (emerald) |
| both | **fuchsia** |
| nothing | neutral |

Intensity (light → dark) indicates how much was done, so a heavy day is dark blue/green and
a heavy day of both is dark fuchsia. Tooltip and summary line list both counts.

## Rules (documented defaults)

- **Climb amount** — existing buckets on climb count: `0 / 1–2 / 3–5 / 6–9 / 10+` →
  level `0–4`. A session with no climbs still floors at level 1 (you were at the wall).
- **Training amount** — number of training habits completed that day:
  `0 / 1 / 2 / 3 / 4+` → level `0–4`.
- **Combined intensity** when both are present: `min(4, climbLevel + trainingLevel)`, so a
  day reads as "how much climbing and training together".
- **Hue** is decided by presence alone (climb / training / both).
- Training counts come from completions of habits **currently** in training. Removing a
  habit quietly rewrites its history on this calendar — accepted, and the alternative
  (a stored per-completion "was training" flag) is not worth it.

## Data path

`useRecentCompletions(ACTIVITY_COLUMNS * 7)` already fetches every habit's completions for
a window; a small `useTrainingActivity(days)` hook filters that map down to the training
habit ids and counts completions per local date. The window is the grid's 16 weeks (112
days), which covers the earliest possible start column.

## Phases

### Phase 1 — Utility (`utils/climbing.ts`)

- [x] `ActivityKind = 'none' | 'climb' | 'training' | 'both'`
- [x] `ActivityCell` gains `trainingCount` and `kind`; `level` becomes the combined 0–4
- [x] `levelForTraining(count)` buckets
- [x] `buildActivityGrid(sessions, trainingByDate, columns)` computes kind + combined level
- [x] `ACTIVITY_COLUMNS = 16`, `CLIMB_SHADES`, `TRAINING_SHADES`, `BOTH_SHADES`,
      `activityShade(kind, level)`; retired `ACTIVITY_SHADES`

### Phase 2 — Hook (`useHabits.ts`)

- [x] `useTrainingActivity(days)` → `{ byDate: Map<date, count> }`, filtered to training ids

### Phase 3 — Component (`ActivityGrid.tsx`)

- [x] New `trainingByDate` prop; pass through to `buildActivityGrid`
- [x] Cell shade via `activityShade(cell.kind, cell.level)`
- [x] Tooltip/aria label includes climbs and training
- [x] Summary line adds training total
- [x] Legend shows climb / training / both hues (+ "darker = more")

### Phase 4 — Wire up (`climbing/index.tsx`)

- [x] `useTrainingActivity(ACTIVITY_COLUMNS * 7)` and pass `trainingByDate`

### Phase 5 — Verification

- [x] `npx tsc --noEmit` clean (apart from the pre-existing `NodeJS` error)
- [x] `pnpm --filter frontend build` passes
- [ ] Manual: climb-only day blue, training-only green, both fuchsia, intensity rises with amount
