/**
 * Checks the habit date arithmetic — streaks, the heatmap grid, and value formatting.
 * These are the parts of the feature that are pure enough to verify without a browser
 * or DynamoDB, and the parts most likely to be wrong by exactly one day.
 *
 * Run with:  pnpm --filter frontend exec tsx scripts/check-habit.ts
 */
import {
  addDays,
  daysBetween,
  currentStreak,
  longestStreak,
  buildHeatmap,
  formatValue,
} from '../src/utils/habit'
import type { Completion, Habit } from '../src/types/habit'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `  got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`)
}

const c = (date: string, extra: Partial<Completion> = {}): Completion => ({
  habitId: 'h',
  timestamp: `${date}T10:00:00.000Z`,
  date,
  notes: '',
  ...extra,
})

// --- date arithmetic ---------------------------------------------------------
check('addDays across a month boundary', addDays('2026-08-31', 1), '2026-09-01')
check('addDays backwards across a year', addDays('2026-01-01', -1), '2025-12-31')
check('addDays across leap Feb', addDays('2024-02-28', 1), '2024-02-29')
check('addDays across non-leap Feb', addDays('2026-02-28', 1), '2026-03-01')
check('daysBetween across leap Feb', daysBetween('2024-02-27', '2024-03-01'), 3)
check('daysBetween across non-leap Feb', daysBetween('2026-02-27', '2026-03-01'), 2)
// A DST spring-forward day in the northern hemisphere; UTC math must be immune.
check('addDays across US DST start', addDays('2026-03-08', 1), '2026-03-09')

// --- current streak ----------------------------------------------------------
check('empty history', currentStreak([], '2026-08-04'), 0)
check(
  'three days ending today',
  currentStreak([c('2026-08-02'), c('2026-08-03'), c('2026-08-04')], '2026-08-04'),
  3
)
check(
  'ending yesterday still counts (grace day)',
  currentStreak([c('2026-08-02'), c('2026-08-03')], '2026-08-04'),
  2
)
check(
  'a full missed day breaks it',
  currentStreak([c('2026-08-01'), c('2026-08-02')], '2026-08-04'),
  0
)
check(
  'streak across a month boundary',
  currentStreak([c('2026-07-31'), c('2026-08-01')], '2026-08-01'),
  2
)
check(
  'streak across leap Feb',
  currentStreak([c('2024-02-28'), c('2024-02-29'), c('2024-03-01')], '2024-03-01'),
  3
)
check(
  'gap of exactly one day breaks',
  currentStreak([c('2026-08-01'), c('2026-08-03'), c('2026-08-04')], '2026-08-04'),
  2
)

// --- longest streak ----------------------------------------------------------
check('longest of empty', longestStreak([]), 0)
check(
  'longest picks the earlier run',
  longestStreak([
    c('2026-07-01'), c('2026-07-02'), c('2026-07-03'), c('2026-07-04'),
    c('2026-07-20'), c('2026-07-21'),
  ]),
  4
)

// --- heatmap -----------------------------------------------------------------
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: 'Read',
  emoji: '📚',
  description: '',
  type: 'count',
  unit: 'pages',
  tags: [],
  color: 'pink',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const today = '2026-08-04' // a Tuesday
const grid = buildHeatmap(habit(), [c('2026-08-03', { count: 5 })], today, 4)

check('heatmap column count', grid.length, 4)
check('heatmap rows per column', grid[0].length, 7)
check('last column ends on Saturday', grid[3][6].date, '2026-08-08')
check('today sits in the last column', grid[3].some((cell) => cell.date === today), true)
check('days after today are marked future', grid[3][6].isFuture, true)
check('today is not future', grid[3].find((c2) => c2.date === today)!.isFuture, false)

const logged = grid[3].find((cell) => cell.date === '2026-08-03')!
check('logged day has a completion', logged.completion !== null, true)
check('sole log with no target scales to full', logged.level, 4)

// With a target, intensity is graded against it rather than the period max.
const graded = buildHeatmap(
  habit({ target: 10 }),
  [c('2026-08-03', { count: 5 }), c('2026-08-02', { count: 10 })],
  today,
  4
)
check('half of target is level 2', graded[3].find((x) => x.date === '2026-08-03')!.level, 2)
check('target met is level 4', graded[3].find((x) => x.date === '2026-08-02')!.level, 4)

// Boolean habits have nothing to grade.
const bool = buildHeatmap(habit({ type: 'boolean', unit: undefined }), [c('2026-08-03')], today, 4)
check('boolean logged day is full', bool[3].find((x) => x.date === '2026-08-03')!.level, 4)
check('unlogged day is level 0', bool[3].find((x) => x.date === '2026-08-02')!.level, 0)
// Aug 1 2026 is a Saturday, so it closes the *previous* column — the grid is
// Sunday-anchored, and getting this wrong is exactly the off-by-one worth pinning.
check('previous column ends on Saturday', bool[2][6].date, '2026-08-01')

// --- formatting --------------------------------------------------------------
check('count formats with unit', formatValue(habit(), c('2026-08-03', { count: 12, unit: 'pages' })), '12 pages')
check('duration under an hour', formatValue(habit({ type: 'duration' }), c('2026-08-03', { durationMinutes: 45 })), '45 min')
check('duration on the hour', formatValue(habit({ type: 'duration' }), c('2026-08-03', { durationMinutes: 120 })), '2h')
check('duration with remainder', formatValue(habit({ type: 'duration' }), c('2026-08-03', { durationMinutes: 95 })), '1h 35m')
check('boolean formats as Done', formatValue(habit({ type: 'boolean' }), c('2026-08-03')), 'Done')

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
