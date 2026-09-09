/**
 * Mirrors `backend/src/modules/habit/habit.types.d.ts`. Habits are a second life app
 * alongside expenses, with their own table and no shared entities.
 */

/**
 * What a single completion measures.
 *
 * - `boolean`  — did it or didn't. The completion carries no value.
 * - `count`    — a quantity in `unit` ("12 pages", "3 glasses").
 * - `duration` — minutes spent.
 */
export type HabitType = 'boolean' | 'count' | 'duration'

/**
 * What a completion record *means* — orthogonal to `HabitType`, which says what it measures.
 *
 * - `build` — the record is a success. A day with no record is simply nothing.
 * - `avoid` — the record is a *slip*. A day with no record, on or after `startDate`, is a
 *   success. "No smoking", "no alcohol": you mark the failures, not the wins.
 *
 * Absent means `build`. Read it through `polarityOf()` in `utils/habit`.
 */
export type HabitPolarity = 'build' | 'avoid'

export interface Habit {
  id: string
  name: string
  emoji: string
  description: string
  type: HabitType
  /** Absent means `build`. Only `avoid` habits carry it explicitly. */
  polarity?: HabitPolarity
  /**
   * `YYYY-MM-DD`, local: the day an `avoid` habit's clean run is measured from. Not derived
   * from `createdAt`, which is a UTC instant and can't express "I quit two months ago".
   */
  startDate?: string
  /** Only meaningful for `count`. */
  unit?: string
  /** Optional daily goal; when set, heatmap intensity is measured against it. */
  target?: number
  tags: string[]
  /**
   * The `HabitGroup` this habit belongs to, or absent when ungrouped. Authority on
   * *membership*; the group's `habitIds` is authority on *order*.
   */
  groupId?: string
  /** The accent itself, as a `#rrggbb` hex — not a key into a palette. */
  color: string
  /**
   * Newest completion's local date, denormalised by the server so the list page can
   * show "done today" without a query per habit. Absent until the first completion.
   *
   * On an `avoid` habit this is the newest *slip* — the same field, read the other way up.
   */
  lastCompletedDate?: string
  createdAt: string
  archived?: boolean
}

export interface CreateHabitInput {
  name: string
  emoji: string
  type: HabitType
  polarity?: HabitPolarity
  startDate?: string
  description?: string
  unit?: string
  target?: number
  tags?: string[]
  /** `null` is "no group" — the form always sends the field, set or not. */
  groupId?: string | null
  color?: string
}

/** `null` clears the attribute. */
export interface UpdateHabitInput {
  name?: string
  emoji?: string
  type?: HabitType
  polarity?: HabitPolarity
  startDate?: string | null
  description?: string
  unit?: string | null
  target?: number | null
  tags?: string[]
  groupId?: string | null
  color?: string
  archived?: boolean
}

/**
 * A named bucket of habits, rendered as a section header on the list page and openable as
 * its own page for reordering.
 *
 * `habitIds` carries display order only — membership is each habit's `groupId`. The two are
 * allowed to disagree: readers append members the array hasn't heard of and skip ids that
 * have moved out, so a half-applied write costs an order, never a habit.
 */
export interface HabitGroup {
  id: string
  name: string
  habitIds: string[]
  createdAt: string
}

export interface CreateHabitGroupInput {
  name: string
}

export interface UpdateHabitGroupInput {
  name?: string
  habitIds?: string[]
}

export interface Completion {
  habitId: string
  /** ISO 8601, server-generated. Identifies the completion for deletes. */
  timestamp: string
  /** `YYYY-MM-DD` in the user's own timezone — always sent from `localToday()`. */
  date: string
  notes: string
  count?: number
  /** Snapshot of the habit's unit at log time. */
  unit?: string
  durationMinutes?: number
}

export interface CreateCompletionInput {
  date: string
  notes?: string
  count?: number
  durationMinutes?: number
}

/**
 * Corrections to an existing completion. `date` is absent on purpose: it is part of the
 * sort key and the subject of the one-per-day rule, so moving a completion to another
 * day is a delete and a re-log rather than an edit.
 */
export interface UpdateCompletionInput {
  notes?: string
  count?: number
  durationMinutes?: number
}

/**
 * One step in a habit's routine.
 *
 * `durationSeconds` is the whole distinction between the two kinds of step: with it,
 * exercise mode runs a countdown and completes the step when it rings; without it, the
 * step is checked off by hand.
 */
export interface ActionItem {
  /** Stable across saves, so a reorder doesn't restart a step mid-session. */
  id: string
  title: string
  description?: string
  /** Absent means a check-off step. */
  durationSeconds?: number
}

/**
 * The ordered routine behind one habit — the thing exercise mode walks through. Fetched
 * per habit rather than with the list, which never reads it.
 */
export interface ActionList {
  habitId: string
  items: ActionItem[]
  updatedAt: string
}

/**
 * A save replaces the whole list, so adding, editing, reordering, and deleting a step are
 * one write — which is what lets the editor be a draft committed once. An item with no
 * `id` is new and the server assigns one; saving zero items deletes the list.
 */
export interface SaveActionListInput {
  items: { id?: string; title: string; description?: string; durationSeconds?: number }[]
}
