import { useCurrency } from '../../contexts/MetadataContext'
import { formatAmount } from '../../utils/currency'

interface MonthHeaderProps {
  yearMonth: string  // "2026-08"
  /** Magnitudes, both positive. Net is derived here, not passed in. */
  income: number
  expense: number
  onPrevious: () => void
  onNext: () => void
}

export function MonthHeader({ yearMonth, income, expense, onPrevious, onNext }: MonthHeaderProps) {
  const { baseCurrency } = useCurrency()
  const net = income - expense
  const [year, month] = yearMonth.split('-').map(Number)
  const monthName = new Date(year, month - 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrevious}
          className="p-2 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-zinc-100">{monthName}</h2>

        <button
          onClick={onNext}
          className="p-2 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm text-zinc-400">Net</p>
        <p className={`text-2xl font-bold ${net > 0 ? 'text-lime-400' : 'text-zinc-100'}`}>
          {/* The sign is explicit on a positive net; a negative amount already carries
              its own minus, so prefixing would double it up. */}
          {net > 0 && '+'}
          {formatAmount(net, baseCurrency)}
        </p>

        <div className="mt-1 flex items-center justify-center gap-4 text-sm">
          <span className="text-zinc-500">
            In <span className="text-lime-400">{formatAmount(income, baseCurrency)}</span>
          </span>
          <span className="text-zinc-500">
            Out <span className="text-zinc-300">{formatAmount(expense, baseCurrency)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
