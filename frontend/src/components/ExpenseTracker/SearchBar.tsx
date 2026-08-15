import { useRef, useEffect } from 'react'
import { MonthPicker } from './MonthPicker'

interface SearchBarProps {
  query: string
  startMonth: string
  endMonth: string
  onQueryChange: (query: string) => void
  onStartMonthChange: (month: string) => void
  onEndMonthChange: (month: string) => void
  onClose: () => void
}

export function SearchBar({
  query,
  startMonth,
  endMonth,
  onQueryChange,
  onStartMonthChange,
  onEndMonthChange,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-800">
      <div className="max-w-lg mx-auto px-4 py-3 space-y-3">
        {/* Text input row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search expenses..."
              className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg pl-10 pr-10 py-2.5 border border-zinc-700 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50 placeholder:text-zinc-500"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>

        {/* Month range row */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <MonthPicker
              value={startMonth}
              onChange={onStartMonthChange}
              label="From"
            />
          </div>
          <div className="flex-1 min-w-0">
            <MonthPicker
              value={endMonth}
              onChange={onEndMonthChange}
              label="To"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
