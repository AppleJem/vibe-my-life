import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/apps')({
  component: AppsPage,
})

/**
 * The point where "Vibe My Life" stops being an expense tracker and becomes a shell that
 * hosts life apps. Two tiles today; the grid takes more without a redesign.
 */
const APPS = [
  {
    to: '/',
    emoji: '💸',
    name: 'Expenses',
    blurb: 'Money in, money out',
    accent: 'text-pink-500',
  },
  {
    to: '/habits',
    emoji: '✅',
    name: 'Habits',
    blurb: 'Things that need doing',
    accent: 'text-lime-400',
  },
] as const

function AppsPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-6">Apps</h2>

      <div className="grid grid-cols-2 gap-4">
        {APPS.map((app) => (
          <button
            key={app.to}
            onClick={() => navigate({ to: app.to })}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 flex flex-col items-start gap-2 hover:bg-zinc-800 transition-colors text-left"
          >
            <span className="text-4xl">{app.emoji}</span>
            <span className={`font-semibold ${app.accent}`}>{app.name}</span>
            <span className="text-xs text-zinc-500">{app.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
