import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'
import { budgetStatus, monthElapsedFraction, type BudgetLevel } from '../../utils/budget'

interface BudgetProgressProps {
  /** Money out for the month on screen, in the base currency. Income is not netted off. */
  spent: number
  /** The cap from settings. 0 (no budget set) renders nothing at all. */
  budget: number
  yearMonth: string // "2026-08"
}

/** Bar fill and the matching text tone, so the two can never drift apart. */
const LEVEL_STYLES: Record<BudgetLevel, { fill: string; text: string }> = {
  ok: { fill: 'bg-lime-400', text: 'text-lime-400' },
  warning: { fill: 'bg-amber-400', text: 'text-amber-400' },
  over: { fill: 'bg-red-400', text: 'text-red-400' },
}

/** Ignore a pace gap this small — a bar a couple of days ahead isn't news. */
const PACE_TOLERANCE = 0.05

export function BudgetProgress({ spent, budget, yearMonth }: BudgetProgressProps) {
  const { baseCurrency } = useCurrency()

  // No budget set: the feature stays invisible rather than showing an empty 0% bar.
  if (budget <= 0) return null

  const { remaining, ratio, percent, level } = budgetStatus(spent, budget)
  const styles = LEVEL_STYLES[level]
  const elapsed = monthElapsedFraction(yearMonth)

  // Pace only reads on the month in progress, and only until the budget is blown —
  // after that the overspend figure already says everything the hint would.
  const pace =
    elapsed === null || level === 'over'
      ? null
      : ratio > elapsed + PACE_TOLERANCE
        ? 'ahead of pace'
        : 'on track'

  return (
    <div className="mb-5 bg-zinc-900 rounded-xl px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-xs font-medium text-zinc-400">Monthly budget</p>
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-200 font-medium">{formatAmount(spent, baseCurrency)}</span>
          {' of '}
          {formatAmount(budget, baseCurrency)}
        </p>
      </div>

      <div
        className="relative h-2 rounded-full bg-zinc-800 overflow-hidden"
        role="progressbar"
        aria-label="Monthly budget used"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={spent}
        aria-valuetext={`${formatAmount(spent, baseCurrency)} of ${formatAmount(budget, baseCurrency)} used`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${styles.fill}`}
          style={{ width: `${percent}%` }}
        />

        {/* Where the month itself has got to — the bar is only "behind" relative to this. */}
        {elapsed !== null && (
          <div
            className="absolute inset-y-0 w-px bg-zinc-100/70"
            style={{ left: `${elapsed * 100}%` }}
            title={`${Math.round(elapsed * 100)}% of the month elapsed`}
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 text-xs">
        <span className={styles.text}>
          {Math.round(ratio * 100)}% used
          {pace && <span className="text-zinc-500">{` · ${pace}`}</span>}
        </span>
        <span className="text-zinc-500">
          {remaining >= 0
            ? `${formatAmount(remaining, baseCurrency)} left`
            : `${formatAmount(-remaining, baseCurrency)} over`}
        </span>
      </div>
    </div>
  )
}
