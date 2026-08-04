import type { RecurringFrequency, RecurringRule } from './recurring.types.d.js'

/**
 * Pure date arithmetic over `YYYY-MM-DD` strings. Nothing here touches the clock or a
 * time zone: the caller supplies "today" (the *client's* local today), so a UTC server
 * never fires a subscription a day early for a user in UTC+8.
 */

/** Safety valve against a corrupt `startDate` far in the past on a daily rule. */
const MAX_OCCURRENCES = 2000

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year: number, month: number) =>
  [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

const parse = (date: string): [number, number, number] => {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

const format = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Days since the epoch, so `daily`/`weekly` can count without a Date object. */
const toDayNumber = (date: string): number => {
  const [y, m, d] = parse(date)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

const fromDayNumber = (days: number): string => {
  const d = new Date(days * 86400000)
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/**
 * The nth occurrence of a rule, counted from its `startDate` — never from the previous
 * result. Computing by index is what stops month-end clamping from drifting: a rule
 * anchored on the 31st gives Feb 28 and then March *31*, not March 28.
 */
export function occurrenceAt(
  startDate: string,
  frequency: RecurringFrequency,
  n: number
): string {
  const [year, month, day] = parse(startDate)

  switch (frequency) {
    case 'daily':
      return fromDayNumber(toDayNumber(startDate) + n)
    case 'weekly':
      return fromDayNumber(toDayNumber(startDate) + n * 7)
    case 'monthly': {
      const total = (year * 12 + (month - 1)) + n
      const targetYear = Math.floor(total / 12)
      const targetMonth = (total % 12) + 1
      return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)))
    }
    case 'yearly': {
      const targetYear = year + n
      // Feb 29 lands on Feb 28 in the three years out of four that aren't leap years,
      // and returns to the 29th in the fourth — same anchor rule as monthly.
      return format(targetYear, month, Math.min(day, daysInMonth(targetYear, month)))
    }
  }
}

/**
 * The smallest `n` whose occurrence falls strictly after `boundary`. Derived by
 * arithmetic rather than by walking from n=0, so a daily rule dormant since 2019 doesn't
 * cost thousands of iterations before reaching the dates that actually matter.
 *
 * Month-end clamping can make the arithmetic estimate land a step either side of the
 * boundary, so the estimate is nudged — never more than a couple of steps.
 */
function firstIndexAfter(
  startDate: string,
  frequency: RecurringFrequency,
  boundary: string
): number {
  const [sy, sm] = parse(startDate)
  const [by, bm] = parse(boundary)

  let n: number
  switch (frequency) {
    case 'daily':
      n = toDayNumber(boundary) - toDayNumber(startDate)
      break
    case 'weekly':
      n = Math.floor((toDayNumber(boundary) - toDayNumber(startDate)) / 7)
      break
    case 'monthly':
      n = (by * 12 + bm) - (sy * 12 + sm)
      break
    case 'yearly':
      n = by - sy
      break
  }

  n = Math.max(0, n)
  while (n > 0 && occurrenceAt(startDate, frequency, n - 1) > boundary) n--
  while (occurrenceAt(startDate, frequency, n) <= boundary) n++
  return n
}

/**
 * Every occurrence the rule owes, oldest first: dates on or before `today` that the rule
 * has not already fired. The `lastRunDate` watermark is the only thing consulted, so a
 * generated row the user deleted is never resurrected.
 */
export function dueOccurrences(rule: RecurringRule, today: string): string[] {
  const { startDate, frequency, lastRunDate } = rule
  if (startDate > today) return []

  const from = lastRunDate ? firstIndexAfter(startDate, frequency, lastRunDate) : 0

  const due: string[] = []
  for (let n = from; n < from + MAX_OCCURRENCES; n++) {
    const date = occurrenceAt(startDate, frequency, n)
    if (date > today) break
    due.push(date)
  }

  return due
}

/**
 * The first occurrence strictly after `after`. Used for the "next run" line in settings,
 * and to re-anchor `lastRunDate` when a rule's schedule is edited.
 */
export function nextOccurrenceAfter(
  startDate: string,
  frequency: RecurringFrequency,
  after: string
): string {
  if (startDate > after) return startDate
  return occurrenceAt(startDate, frequency, firstIndexAfter(startDate, frequency, after))
}

/**
 * The latest occurrence on or before `on`, or undefined if the rule hasn't started yet.
 *
 * Editing a rule's frequency or start date re-anchors `lastRunDate` to this, so the new
 * schedule takes effect strictly going forward — moving a two-year-old monthly rule to
 * daily must not backfill seven hundred rows.
 */
export function latestOccurrenceOnOrBefore(
  startDate: string,
  frequency: RecurringFrequency,
  on: string
): string | undefined {
  if (startDate > on) return undefined
  return occurrenceAt(startDate, frequency, firstIndexAfter(startDate, frequency, on) - 1)
}
