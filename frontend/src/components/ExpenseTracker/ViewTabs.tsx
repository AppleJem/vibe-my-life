export type DashboardView = 'list' | 'chart'

interface ViewTabsProps {
  value: DashboardView
  onChange: (view: DashboardView) => void
}

const TABS: { view: DashboardView; label: string; icon: React.ReactNode }[] = [
  {
    view: 'list',
    label: 'Expenses',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    ),
  },
  {
    view: 'chart',
    label: 'Breakdown',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9A9.004 9.004 0 0015 3.512V9h5.488z" />
    ),
  },
]

export function ViewTabs({ value, onChange }: ViewTabsProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/80 backdrop-blur-sm border-t border-zinc-800 pb-[env(safe-area-inset-bottom)]">
      <div role="tablist" className="max-w-lg mx-auto px-4 flex">
        {TABS.map(({ view, label, icon }) => {
          const isActive = value === view

          return (
            <button
              key={view}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(view)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? 'text-pink-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {icon}
              </svg>
              <span className="text-xs font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
