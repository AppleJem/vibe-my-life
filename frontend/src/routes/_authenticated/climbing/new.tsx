import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DatePicker } from '../../../components/ExpenseTracker/AddExpenseModal/DatePicker'
import { LocationInput } from '../../../components/Climbing/LocationInput'
import { useKnownLocations, useLastGradeSettings, useSessions } from '../../../hooks/useClimbing'
import { todayStr } from '../../../utils/climbing'

export const Route = createFileRoute('/_authenticated/climbing/new')({
  component: NewSessionPage,
})

/**
 * Two fields and a button. A session is a date and a place — everything else is a climb,
 * and climbs are logged on the session screen this leads straight into.
 *
 * The grade system isn't asked for here: it's inherited from the last session, and changing
 * it is one tap at the top of the screen you're about to land on.
 */
function NewSessionPage() {
  const navigate = useNavigate()
  const { createSession, creating } = useSessions()
  const locations = useKnownLocations()
  const { gradeSystem, gradeKind } = useLastGradeSettings()

  const [date, setDate] = useState(todayStr())
  const [location, setLocation] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canSave = location.trim().length > 0 && !creating

  const handleCreate = async () => {
    if (!canSave) return
    setError(null)

    try {
      const session = await createSession({
        date,
        location: location.trim(),
        gradeSystem,
        gradeKind,
        climbs: [],
      })
      navigate({ to: '/climbing/$sessionId', params: { sessionId: session.id } })
    } catch {
      setError("Couldn't create the session — try again?")
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: '/climbing' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-zinc-100">New session</h2>
      </div>

      <div className="space-y-6">
        <section>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Location</p>
          <LocationInput
            value={location}
            suggestions={locations}
            onChange={setLocation}
            autoFocus
          />
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Date</p>
          <DatePicker value={date} onChange={setDate} />
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!canSave}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-zinc-950 font-semibold disabled:opacity-40 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 transition-colors"
        >
          {creating ? 'Starting…' : 'Start session'}
        </button>
      </div>
    </>
  )
}
