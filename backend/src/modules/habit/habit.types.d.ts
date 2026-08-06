/**
 * Habits live in their own table (`vibe-my-life-habit`), keyed the same way as expenses:
 * `PK = USER#<userId>`, with the sort key discriminating the two item shapes.
 *
 *   Definition  SK = META#<habitId>
 *   Completion  SK = HABIT#<habitId>#COMPLETION#<timestamp>
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
  /** Shown in the list and inside the big check box on the detail page. */
  emoji: string
  description: string
  type: HabitType
  /** Only meaningful for `count`; absent on the other two types. */
  unit?: string
  /** Optional daily goal. When set, it is what heatmap intensity is measured against. */
  target?: number
  tags: string[]
  /**
   * Free-text heading the list groups by — "Rehab exercises". Stored with the casing the
   * user typed, unlike tags: it is read as a title, not matched against. Absent when the
   * habit belongs to no group.
   */
  group?: string
  /** Accent key from the fixed palette; tints the heatmap and the big box. */
  color: string
  /**
   * Denormalised copy of the newest completion's local `date`, so the list page can show
   * "done today" for every habit from a single query instead of one query per habit.
   * Absent when the habit has never been completed.
   */
  lastCompletedDate?: string
  createdAt: string
  /** Archived habits drop off the list but keep their history. */
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

/** `null` clears the attribute, mirroring the expense update convention. */
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
  /** ISO 8601, server-generated. Also the sort-key suffix, so history sorts chronologically. */
  timestamp: string
  /**
   * `YYYY-MM-DD` in the *client's* timezone — never derived from `timestamp`. The server
   * runs UTC, so a 10pm SGT log would otherwise be filed under tomorrow.
   */
  date: string
  notes: string
  /** Present for `count` habits. */
  count?: number
  /** Snapshot of the habit's unit at log time, so renaming it later doesn't rewrite history. */
  unit?: string
  /** Present for `duration` habits. */
  durationMinutes?: number
}

export interface CreateCompletionInput {
  date: string
  notes?: string
  count?: number
  durationMinutes?: number
}
