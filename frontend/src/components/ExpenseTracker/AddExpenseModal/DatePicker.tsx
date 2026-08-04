import { useState } from 'react'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [viewYear, setViewYear] = useState(() => {
    const [year] = value.split('-').map(Number)
    return year
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const [, month] = value.split('-').map(Number)
    return month
  })

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Get days in month
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay()

  // Generate calendar days
  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const goToPreviousMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
  }

  const monthName = new Date(viewYear, viewMonth - 1).toLocaleString('en-US', {
    month: 'long',
  })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={goToPreviousMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-zinc-100 font-semibold">
          {monthName} {viewYear}
        </span>
        <button
          onClick={goToNextMonth}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-center text-[10px] text-zinc-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} />
          }

          const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = dateStr === value
          const isToday = dateStr === todayStr

          let className = 'w-full h-8 rounded-md flex items-center justify-center text-xs font-medium transition-colors '

          if (isSelected) {
            className += 'bg-cyan-400 text-zinc-950'
          } else if (isToday) {
            className += 'bg-rose-400/20 text-rose-400'
          } else {
            className += 'text-zinc-300 hover:bg-zinc-800'
          }

          return (
            <button
              key={day}
              onClick={() => selectDay(day)}
              className={className}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
