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
   * Free-text heading the list groups by — "Rehab exercises". Kept as typed, unlike tags:
   * it is read as a title rather than matched against. Absent when ungrouped.
   */
  group?: string
  /** Key into ACCENTS in `constants/habitColors.ts`. */
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
  /** `null` is "no group" — the form always sends the field, empty or not. */
  group?: string | null
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
  group?: string | null
  color?: string
  archived?: boolean
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
