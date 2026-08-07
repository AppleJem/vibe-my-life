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

export interface Habit {
  id: string
  name: string
  emoji: string
  description: string
  type: HabitType
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
   */
  lastCompletedDate?: string
  createdAt: string
  archived?: boolean
}

export interface CreateHabitInput {
  name: string
  emoji: string
  type: HabitType
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
