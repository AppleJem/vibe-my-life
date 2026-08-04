/**
 * Checks the .xlsx backup parser against a real export.
 *
 *   pnpm --filter backend exec tsx scripts/check-import.ts ~/Downloads/2026-08-04.xlsx
 *
 * The expected values below were established by reading the raw sheet XML of that
 * file directly, independently of exceljs — so this is a genuine cross-check of the
 * parser, not a snapshot of its own output.
 */
import { readFileSync } from 'node:fs'
import { parseBackup, normalizeCategoryName } from '../src/modules/import/import.parser.js'

const file = process.argv[2]
if (!file) {
  console.error('usage: tsx scripts/check-import.ts <backup.xlsx>')
  process.exit(1)
}

let failures = 0

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failures++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? ` = ${a}` : `\n         expected ${e}\n         actual   ${a}`}`)
}

const result = await parseBackup(readFileSync(file))
const { rows } = result

console.log('\n--- totals ---')
check('data rows', result.totalDataRows, 450)
check('importable rows', rows.length, 425)
check('income skipped', result.skipped.income, 25)
check('transfers skipped', result.skipped.transfer, 0)
check('invalid skipped', result.skipped.invalid, 0)
// Refunded / voucher-paid / someone-else-paid records. Kept, not dropped.
check('zero-amount rows kept', result.zeroAmountRows, 3)
check('base currency', result.baseCurrency, 'SGD')
check('currencies seen', [...result.currencies].sort(), ['CNY', 'MYR', 'SGD', 'USD'])
check('accounts seen', [...result.accounts].sort(), ['Cash', 'MariBank credit card', 'POSB Deposit acc'])
check('warnings', result.warnings, [])

console.log('\n--- dates ---')
const dates = rows.map((r) => r.date).sort()
// The file's overall range starts 2025-12-18, but that row is income; the earliest
// *expense* is 2025-12-31.
check('earliest date', dates[0], '2025-12-31')
check('latest date', dates[dates.length - 1], '2027-01-06')
// Serial 46235.51490740741 -> 2026-08-01 12:21:28 UTC. The cell's number format is
// dd/MM/yyyy, so Excel hides the time, but it is real and we keep it in createdAt.
const boulder = rows.find((r) => r.note.startsWith('Boulder planet membership freeze'))
check('time-carrying row date', boulder?.date, '2026-08-01')
check('time-carrying row createdAt', boulder?.createdAt, '2026-08-01T12:21:28.000Z')
check('no createdAt collapsed to midnight', rows.every((r) => r.createdAt.startsWith(r.date)), true)
check('every row keeps its time-of-day', rows.filter((r) => !r.createdAt.endsWith('T00:00:00.000Z')).length, 425)

console.log('\n--- amounts & currency ---')
check('no negative amounts', rows.every((r) => r.amount >= 0), true)
check('all amounts at 2dp', rows.every((r) => Math.abs(r.amount * 100 - Math.round(r.amount * 100)) < 1e-6), true)
// Raw value in the sheet is 9.369999999999999.
const artifact = rows.find((r) => r.note === 'Various expenses' && r.originalAmount === 50)
check('float artifact rounded', artifact?.amount, 9.37)

const foreign = rows.filter((r) => r.currency !== undefined)
check('foreign rows', foreign.length, 32)
check('foreign rows carry all three fields',
  foreign.every((r) => r.originalAmount !== undefined && r.rate !== undefined), true)
check('base rows carry none of the three',
  rows.filter((r) => r.currency === undefined)
    .every((r) => r.originalAmount === undefined && r.rate === undefined), true)
check('every row snapshots baseCurrency', rows.every((r) => r.baseCurrency === 'SGD'), true)

// 45.5 CNY recorded as 8.52 SGD -> ~5.34 CNY per SGD.
const apron = rows.find((r) => r.note === 'Apron and climbing tape')
check('known rate direction (CNY per SGD)', apron?.rate, 5.340376)
check('known rate original amount', apron?.originalAmount, 45.5)
check('rate reconstructs the base amount',
  foreign.every((r) => Math.abs(r.originalAmount! / r.rate! - r.amount) < 0.01), true)

console.log('\n--- notes ---')
// 20 rows in the file carry both, but one of them is income and so never imported.
check('rows joining Note + Description', rows.filter((r) => r.note.includes(' — ')).length, 19)
const giga = rows.find((r) => r.note.startsWith('Giga! plan'))
check('note + description joined',
  giga?.note,
  'Giga! plan — Refreshes actually on the 28th, but putting on the 1st for awareness')
check('notes are trimmed', rows.every((r) => r.note === r.note.trim()), true)
check('no note contains the category separator', rows.every((r) => !r.note.includes('#')), true)

console.log('\n--- categories ---')
const pairs = new Set(rows.map((r) => `${r.sourceCategory}|${r.sourceSubcategory ?? ''}`))
check('distinct (category, subcategory) pairs', pairs.size, 30)
const parents = new Set(rows.map((r) => r.sourceCategory))
check('distinct parents', parents.size, 15)
check('income-only categories absent', parents.has('💰 Salary') || parents.has('🎠Carousell'), false)
check('no category contains the separator',
  rows.every((r) => !r.sourceCategory.includes('#') && !(r.sourceSubcategory ?? '').includes('#')), true)
check('categories are trimmed', rows.every((r) => r.sourceCategory === r.sourceCategory.trim()), true)

console.log('\n--- emoji-insensitive matching ---')
const APP_DEFAULTS = [
  '🍜 Food', '🚗 Transport', '🏠 Household', '👕 Apparel', '⚽ Sports', '📚 Education',
  '🎁 Gift', '🛒 Shopping', '🏥 Medical', '💕 Dating', '✈️ Travel', '📦 Other',
]
const byNormalized = new Map(APP_DEFAULTS.map((n) => [normalizeCategoryName(n), n]))
const matched = [...parents].filter((p) => byNormalized.has(normalizeCategoryName(p)))
check('file parents auto-matching an app default', matched.length, 12)
check('unmatched parents', [...parents].filter((p) => !byNormalized.has(normalizeCategoryName(p))).sort(),
  ['Gaming', 'Joint account', '👬🏻 Social Life'])
for (const source of matched.sort()) {
  console.log(`         ${source.padEnd(16)} -> ${byNormalized.get(normalizeCategoryName(source))}`)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
