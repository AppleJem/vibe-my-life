import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ActivityGrid } from '../../../components/Climbing/ActivityGrid'
import { useSessions } from '../../../hooks/useClimbing'
import { formatSessionDate, solveCount } from '../../../utils/climbing'

export const Route = createFileRoute('/_authenticated/climbing/')({
  component: ClimbingPage,
})

function ClimbingPage() {
  const navigate = useNavigate()
  const { sessions, loading, error } = useSessions()

  const openSession = (sessionId: string) =>
    navigate({ to: '/climbing/$sessionId', params: { sessionId } })

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/apps' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">Climbing</h2>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          <div className="h-44 bg-zinc-800 rounded-2xl animate-pulse mb-6" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <ActivityGrid sessions={sessions} onPickSession={openSession} />

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🧗</p>
              <p className="text-zinc-400">No sessions yet</p>
              <p className="text-sm text-zinc-600 mt-1">
                Log where and when — the climbs go in as you do them.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => {
                const solves = solveCount(session.climbs)

                return (
                  <li key={session.id}>
                    <button
                      onClick={() => openSession(session.id)}
                      className="w-full flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-left hover:bg-zinc-800 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-100">{session.location}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {formatSessionDate(session.date)} · {session.climbs.length}{' '}
                          {session.climbs.length === 1 ? 'climb' : 'climbs'}
                          {solves > 0 && ` · ${solves} solved`}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-sky-400">{session.gradeSystem}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <button
        onClick={() => navigate({ to: '/climbing/new' })}
        aria-label="New session"
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 shadow-lg shadow-sky-500/25 flex items-center justify-center text-zinc-950 text-3xl"
      >
        +
      </button>
    </>
  )
}
