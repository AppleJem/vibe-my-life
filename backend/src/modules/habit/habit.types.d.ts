/**
 * Habits live in their own table (`vibe-my-life-habit`), keyed the same way as expenses:
 * `PK = USER#<userId>`, with the sort key discriminating the item shapes.
 *
 *   Definition  SK = META#<habitId>
 *   Completion  SK = HABIT#<habitId>#COMPLETION#<timestamp>
 *   Group       SK = HABIT_GROUP#<groupId>
 *
 * `HABIT_GROUP#` deliberately does not begin with `HABIT#` — the sixth character differs —
 * so it stays clear of the bare `begins_with(SK, 'HABIT#')` sweep `listRecentCompletions`
 * uses to pull every habit's completions in one query. Any future prefix has to clear the
 * same bar.
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
   * The `HabitGroup` this habit belongs to, or absent when it belongs to none. This is the
   * authority on *membership*; the group's own `habitIds` is the authority on *order*.
   */
  groupId?: string
  /** Accent as a `#rrggbb` hex; tints the heatmap and the big box. */
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
  /** `null` is "no group" — the form always sends the field, set or not. */
  groupId?: string | null
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
  groupId?: string | null
  color?: string
  archived?: boolean
}

/**
 * A named bucket of habits, rendered as a section header on the list page.
 *
 * `habitIds` is the display order and nothing more: membership is read off each habit's
 * `groupId`. Keeping order separate from membership means the two can disagree without
 * anything breaking — the reader appends members the array has never heard of and skips
 * ids that have since moved out — so a failed write leaves a stale order, not a lost habit.
 */
export interface HabitGroup {
  id: string
  /** Free text, stored with the casing the user typed. It is read as a heading. */
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

/**
 * What a completion can be corrected to after the fact. `date` is deliberately absent:
 * it is part of the sort key and the subject of the one-per-day rule, so moving a
 * completion to another day is a delete and a re-log, not an edit.
 */
export interface UpdateCompletionInput {
  notes?: string
  count?: number
  durationMinutes?: number
}
