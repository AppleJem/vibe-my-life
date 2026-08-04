/**
 * Checks the recurring schedule arithmetic — the one part of the feature that is pure
 * enough to verify without DynamoDB.
 *
 *   pnpm --filter backend exec tsx scripts/check-schedule.ts
 *
 * The expected dates below were worked out from the calendar, not from running the
 * code, so this is a real check rather than a snapshot of the implementation.
 */
import {
  occurrenceAt,
  dueOccurrences,
  nextOccurrenceAfter,
  latestOccurrenceOnOrBefore,
} from '../src/modules/recurring/recurring.schedule.js'
import type { RecurringFrequency, RecurringRule } from '../src/modules/recurring/recurring.types.d.js'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? ` = ${a}` : `\n         expected ${e}\n         actual   ${a}`}`
  )
}

const rule = (
  startDate: string,
  frequency: RecurringFrequency,
  lastRunDate?: string
): RecurringRule => ({
  id: 'r1',
  type: 'expense',
  frequency,
  startDate,
  ...(lastRunDate && { lastRunDate }),
  amount: 19.99,
  category: '🍜 Food',
  note: 'Netflix',
  remarks: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const series = (start: string, frequency: RecurringFrequency, count: number) =>
  Array.from({ length: count }, (_, n) => occurrenceAt(start, frequency, n))

console.log('\nmonth-end clamping (must not drift)')
check('monthly from 2026-01-31', series('2026-01-31', 'monthly', 4), [
  '2026-01-31',
  '2026-02-28',
  '2026-03-31',
  '2026-04-30',
])
check('monthly from 2028-01-31 (leap Feb)', series('2028-01-31', 'monthly', 3), [
  '2028-01-31',
  '2028-02-29',
  '2028-03-31',
])
check('monthly crosses the year', series('2026-11-15', 'monthly', 3), [
  '2026-11-15',
  '2026-12-15',
  '2027-01-15',
])

console.log('\nyearly')
check('yearly from 2024-02-29', series('2024-02-29', 'yearly', 5), [
  '2024-02-29',
  '2025-02-28',
  '2026-02-28',
  '2027-02-28',
  '2028-02-29',
])

console.log('\ndaily / weekly')
check('daily across a month boundary', series('2026-08-30', 'daily', 4), [
  '2026-08-30',
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
])
check('weekly stays on Tuesday', series('2026-08-04', 'weekly', 4), [
  '2026-08-04',
  '2026-08-11',
  '2026-08-18',
  '2026-08-25',
])

console.log('\ndue occurrences — the brief’s own examples')
// Netflix, monthly, created 4 Jul 2026; today is 4 Aug 2026 and it has never fired.
check('monthly since 4 Jul, never run, today 4 Aug', dueOccurrences(rule('2026-07-04', 'monthly'), '2026-08-04'), [
  '2026-07-04',
  '2026-08-04',
])
// Same rule, already fired in July: only August is owed.
check(
  'monthly since 4 Jul, last run 4 Jul',
  dueOccurrences(rule('2026-07-04', 'monthly', '2026-07-04'), '2026-08-04'),
  ['2026-08-04']
)
// Monthly income on the 9th, today is the 4th — nothing is due yet.
check(
  'monthly on the 9th, today the 4th',
  dueOccurrences(rule('2026-03-09', 'monthly', '2026-07-09'), '2026-08-04'),
  []
)
check('re-run on the same day is empty', dueOccurrences(rule('2026-07-04', 'monthly', '2026-08-04'), '2026-08-04'), [])
check('start date in the future', dueOccurrences(rule('2026-09-01', 'monthly'), '2026-08-04'), [])
check('backfills a long daily gap', dueOccurrences(rule('2026-07-30', 'daily', '2026-07-31'), '2026-08-04').length, 4)

console.log('\nnext / latest')
check('next after 2026-08-04, monthly on the 4th', nextOccurrenceAfter('2026-07-04', 'monthly', '2026-08-04'), '2026-09-04')
check('next when the rule has not started', nextOccurrenceAfter('2026-09-01', 'monthly', '2026-08-04'), '2026-09-01')
check('next weekly', nextOccurrenceAfter('2026-08-04', 'weekly', '2026-08-04'), '2026-08-11')
check('latest on or before, monthly', latestOccurrenceOnOrBefore('2026-01-31', 'monthly', '2026-08-04'), '2026-07-31')
check('latest before the start is undefined', latestOccurrenceOnOrBefore('2026-09-01', 'monthly', '2026-08-04'), undefined)
check('latest lands exactly on the day', latestOccurrenceOnOrBefore('2026-07-04', 'monthly', '2026-08-04'), '2026-08-04')

console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} check(s) failed\n`)
process.exit(failures === 0 ? 0 : 1)
