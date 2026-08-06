import type { Completion, Habit } from '../types/habit'

/**
 * Pure helpers for the habit detail page — streaks, the heatmap grid, and per-type
 * value formatting.
 *
 * Everything here takes `today` as an argument rather than reading the clock, the same
 * discipline as `recurring.schedule.ts`: it makes the date arithmetic checkable, and it
 * keeps the "what is today" decision in one place (`localToday()` in `./recurring`).
 * Dates are `YYYY-MM-DD` strings throughout and are never round-tripped through a local
 * `Date` — `Date.UTC` only, so a DST boundary can't shift a day.
 */

const DAY_MS = 86_400_000

const format = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`

const parse = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

/** `2026-08-04` + 1 → `2026-08-05`. Negative steps go backwards. */
export function addDays(date: string, days: number): string {
  return format(new Date(parse(date) + days * DAY_MS))
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS)
}

/** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
export function weekdayOf(date: string): number {
  return new Date(parse(date)).getUTCDay()
}

/** `2026-08-04` → `4 Aug`. */
export function formatShortDate(date: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [, month, day] = date.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}`
}

/**
 * The days a habit has been logged, newest first. One completion per day is enforced
 * server-side, so this is a set of days, not a multiset.
 */
const datesOf = (completions: Completion[]): string[] =>
  [...new Set(completions.map((c) => c.date))].sort().reverse()

/**
 * Days logged in an unbroken run ending today — or ending yesterday, which still counts.
 *
 * The grace day matters: a habit logged every day for a month should not read "0 day
 * streak" from midnight until the moment it is logged again. It breaks only once a full
 * day has been missed.
 */
export function currentStreak(completions: Completion[], today: string): number {
  const dates = datesOf(completions)
  if (dates.length === 0) return 0

  const gap = daysBetween(dates[0], today)
  if (gap > 1) return 0

  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i], dates[i - 1]) !== 1) break
    streak++
  }

  return streak
}

/** The longest unbroken run anywhere in the history. */
export function longestStreak(completions: Completion[]): number {
  const dates = datesOf(completions)
  if (dates.length === 0) return 0

  let longest = 1
  let run = 1

  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i], dates[i - 1]) === 1) {
      run++
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  return longest
}

/** The value a completion contributes to heatmap intensity. Boolean logs count as 1. */
export function valueOf(completion: Completion): number {
  return completion.count ?? completion.durationMinutes ?? 1
}

/** "12 pages", "45 min", or "Done" — whatever the habit's type measures. */
export function formatValue(habit: Habit, completion: Completion): string {
  if (completion.count !== undefined) {
    const unit = completion.unit ?? habit.unit ?? ''
    return unit ? `${completion.count} ${unit}` : String(completion.count)
  }

  if (completion.durationMinutes !== undefined) {
    const minutes = completion.durationMinutes
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
  }

  return 'Done'
}

/**
 * `Morning Routine` → `morning-routine`.
 *
 * Tags are matched against each other — for autocomplete, and for the day someone wants
 * to filter by one — so they are normalised to a single shape rather than left as typed.
 * Groups are deliberately *not* put through this: they are headings people read.
 *
 * Returns `''` for input with nothing usable in it; callers drop those.
 */
export function normaliseTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * What a full-intensity day is worth: the habit's target when it has one, otherwise the
 * best day in `completions`, so a habit with no goal still shows relative effort rather
 * than a flat wall of one colour. `null` means there is nothing to grade — a boolean
 * habit, or a stretch with nothing logged in it.
 */
export function intensityScale(habit: Habit, completions: Completion[]): number | null {
  if (habit.type === 'boolean') return null
  if (habit.target !== undefined && habit.target > 0) return habit.target

  const max = Math.max(0, ...completions.map(valueOf))
  return max > 0 ? max : null
}

/** 0 when nothing was logged, 1–4 by ratio against `scale`. Ungraded days are all 4. */
export function levelFor(
  completion: Completion | null,
  scale: number | null
): 0 | 1 | 2 | 3 | 4 {
  if (!completion) return 0
  if (scale === null) return 4

  const ratio = valueOf(completion) / scale
  if (ratio >= 1) return 4
  if (ratio >= 0.66) return 3
  if (ratio >= 0.33) return 2
  return 1
}

export interface HeatmapCell {
  date: string
  /** 0 = nothing logged, 1–4 = increasing intensity. */
  level: 0 | 1 | 2 | 3 | 4
  completion: Completion | null
  /** Days after `today` — rendered as empty placeholders so the grid stays rectangular. */
  isFuture: boolean
}

/**
 * A GitHub-style grid: `weeks` columns of 7 days, each column Sunday→Saturday, ending on
 * the week containing `today`.
 *
 * Intensity is measured against the habit's `target` when it has one, and against the
 * period's own maximum otherwise — so a habit with no goal still shows relative effort
 * rather than a flat wall of one colour. Boolean habits have nothing to grade, so every
 * logged day is level 4.
 */
export function buildHeatmap(
  habit: Habit,
  completions: Completion[],
  today: string,
  weeks = 26
): HeatmapCell[][] {
  const byDate = new Map(completions.map((c) => [c.date, c]))

  // Wind back to the Sunday of the current week, then back `weeks - 1` further.
  const start = addDays(today, -weekdayOf(today) - (weeks - 1) * 7)
  const scale = intensityScale(habit, completions)

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day)
      const completion = byDate.get(date) ?? null

      return {
        date,
        completion,
        level: levelFor(completion, scale),
        isFuture: date > today,
      } satisfies HeatmapCell
    })
  )
}
