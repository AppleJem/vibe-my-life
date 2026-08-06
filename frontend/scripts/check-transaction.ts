/**
 * Checks the transaction ordering and sign helpers. The list groups by date and then
 * sorts within the day, and the within-day part is the piece that has no natural
 * ordering coming out of the store — the API returns a day's rows in uuid order.
 *
 * Run with:  pnpm --filter backend exec tsx ../frontend/scripts/check-transaction.ts
 * (tsx lives in the backend's devDependencies, not the frontend's.)
 */
import { byNewestFirst, signedAmount, sumOf, typeOf } from '../src/utils/transaction'
import type { Expense } from '../src/types/expense'

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `  got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`)
}

const e = (id: string, createdAt: string, extra: Partial<Expense> = {}): Expense => ({
  id,
  date: '2026-08-05',
  amount: 10,
  category: '🍜 Food',
  note: '',
  createdAt,
  ...extra,
})

const order = (rows: Expense[]) => [...rows].sort(byNewestFirst).map((r) => r.id)

// --- within-day ordering -----------------------------------------------------
const day = [
  e('a', '2026-08-05T08:15:00.000Z'),
  e('c', '2026-08-05T19:40:00.000Z'),
  e('b', '2026-08-05T12:00:00.000Z'),
]
check('newest first within a day', order(day), ['c', 'b', 'a'])

// The uuid order the API hands back must not leak through.
check('input order does not matter', order([day[2], day[0], day[1]]), ['c', 'b', 'a'])

// An import with no time-of-day collapses every row to midnight; those must still
// come out in a fixed order rather than shuffling between renders.
const midnight = [
  e('zz', '2026-08-05T00:00:00.000Z'),
  e('aa', '2026-08-05T00:00:00.000Z'),
  e('mm', '2026-08-05T00:00:00.000Z'),
]
check('equal timestamps break on id', order(midnight), ['aa', 'mm', 'zz'])
check('...and stay stable when reshuffled', order([midnight[2], midnight[0], midnight[1]]), ['aa', 'mm', 'zz'])

// A row missing its timestamp sorts last instead of poisoning the comparison.
const missing = [
  e('good', '2026-08-05T09:00:00.000Z'),
  e('blank', '' as string),
  e('later', '2026-08-05T21:00:00.000Z'),
]
check('unparseable createdAt sinks', order(missing), ['later', 'good', 'blank'])

// Sub-second precision matters: two expenses added back to back in the modal are
// seconds apart, and the newer one belongs on top.
const rapid = [
  e('first', '2026-08-05T10:00:01.100Z'),
  e('second', '2026-08-05T10:00:01.900Z'),
]
check('sub-second ordering', order(rapid), ['second', 'first'])

// --- signs and sums ----------------------------------------------------------
check('absent type reads as expense', typeOf(e('x', '2026-08-05T10:00:00.000Z')), 'expense')
check('expense is negative', signedAmount(e('x', '2026-08-05T10:00:00.000Z', { amount: 12.5 })), -12.5)
check(
  'income is positive',
  signedAmount(e('x', '2026-08-05T10:00:00.000Z', { amount: 4000, type: 'income' })),
  4000
)
check('sumOf adds magnitudes', sumOf([e('a', '', { amount: 3 }), e('b', '', { amount: 4.5 })]), 7.5)

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
