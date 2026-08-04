import type { RecurringFrequency, RecurringRule } from '../types/expense'

/**
 * Display-side schedule helpers. The backend is authoritative for *generating*
 * occurrences (`recurring.schedule.ts`); this file only answers "when is it next due"
 * for the settings list, and mirrors the same clamping rules so the two never disagree
 * on screen.
 */

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly']

/** The user's local calendar day as YYYY-MM-DD — never `toISOString()`, which is UTC. */
export function localToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year: number, month: number) =>
  [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

const format = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** The nth occurrence, counted from `startDate` rather than from the previous result. */
function occurrenceAt(startDate: string, frequency: RecurringFrequency, n: number): string {
  const [year, month, day] = startDate.split('-').map(Number)

  switch (frequency) {
    case 'daily':
    case 'weekly': {
      const step = frequency === 'daily' ? 1 : 7
      const d = new Date(Date.UTC(year, month - 1, day + n * step))
      return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
    case 'monthly': {
      const total = year * 12 + (month - 1) + n
      const targetYear = Math.floor(total / 12)
      const targetMonth = (total % 12) + 1
      return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
    }
    case 'yearly':
      return format(year + n, month, Math.min(day, daysInMonth(year + n, month)))
  }
}

/**
 * When the rule fires next. Anchored on `lastRunDate` when it has already run, so a
 * schedule that fired today shows next month rather than today.
 */
export function nextRunDate(rule: RecurringRule, today = localToday()): string {
  const boundary = rule.lastRunDate && rule.lastRunDate > today ? rule.lastRunDate : today
  if (rule.startDate > boundary) return rule.startDate

  // Estimate the index arithmetically, then nudge — month-end clamping can push the
  // estimate a step either side of the boundary.
  const [sy, sm] = rule.startDate.split('-').map(Number)
  const [by, bm] = boundary.split('-').map(Number)

  let n: number
  switch (rule.frequency) {
    case 'daily':
    case 'weekly': {
      const days = Math.round(
        (Date.parse(`${boundary}T00:00:00Z`) - Date.parse(`${rule.startDate}T00:00:00Z`)) / 86400000
      )
      n = Math.floor(days / (rule.frequency === 'daily' ? 1 : 7))
      break
    }
    case 'monthly':
      n = by * 12 + bm - (sy * 12 + sm)
      break
    case 'yearly':
      n = by - sy
      break
  }

  n = Math.max(0, n)
  while (n > 0 && occurrenceAt(rule.startDate, rule.frequency, n - 1) > boundary) n--
  while (occurrenceAt(rule.startDate, rule.frequency, n) <= boundary) n++
  return occurrenceAt(rule.startDate, rule.frequency, n)
}

/** `4 Aug 2026` — the settings list is dense enough that the year matters. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
