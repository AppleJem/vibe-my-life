import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ClimbRow } from '../../../components/Climbing/ClimbRow'
import { GradeSystemPicker } from '../../../components/Climbing/GradeSystemPicker'
import { LocationInput } from '../../../components/Climbing/LocationInput'
import { DatePicker } from '../../../components/ExpenseTracker/AddExpenseModal/DatePicker'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useKnownLocations, useSession } from '../../../hooks/useClimbing'
import { useMediaEnabled, useMediaUrls } from '../../../hooks/useMediaUrls'
import { useDebounce } from '../../../hooks/useDebounce'
import { formatSessionDate, solveCount } from '../../../utils/climbing'
import type { Climb, ClimbingSession, GradeKind, SessionInput } from '../../../types/climbing'

export const Route = createFileRoute('/_authenticated/climbing/$sessionId')({
  component: SessionPage,
})

/** How long typing has to stop before the session is written. */
const AUTOSAVE_DELAY_MS = 1000

/** The parts of a session a save sends — everything except the server's own bookkeeping. */
const toInput = (session: ClimbingSession): SessionInput => ({
  date: session.date,
  location: session.location,
  gradeSystem: session.gradeSystem,
  gradeKind: session.gradeKind,
  climbs: session.climbs,
})

function SessionPage() {
  const { sessionId } = Route.useParams()
  const navigate = useNavigate()

  const {
    session,
    loading,
    notFound,
    unreachable,
    retry,
    updateSession,
    saving,
    saveFailed,
    deleteSession,
  } = useSession(sessionId)
  const locations = useKnownLocations()
  const mediaEnabled = useMediaEnabled()

  const [draft, setDraft] = useState<SessionInput | null>(null)

  /**
   * Which climbs are open for editing. Purely a view state — nothing here is saved, and
   * nothing about it reaches the server.
   *
   * Empty to begin with, so a session you have opened to look at reads as a finished list
   * rather than a page of live inputs: a climb already stored was, by definition, already
   * logged. Adding one opens it; ticking it closes it again.
   */
  const [editingIds, setEditingIds] = useState<ReadonlySet<string>>(() => new Set())

  const setEditing = (id: string, open: boolean) =>
    setEditingIds((current) => {
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  const [editingHeader, setEditingHeader] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // The draft is seeded once. Re-seeding on every server response would stamp on whatever
  // was typed while a save was in flight.
  useEffect(() => {
    if (session && draft === null) setDraft(toInput(session))
  }, [session, draft])

  const serialised = draft ? JSON.stringify(draft) : ''
  const debounced = useDebounce(serialised, AUTOSAVE_DELAY_MS)

  // What the server last confirmed, so a save only fires for a change it hasn't seen. Not
  // state: writing it would re-render and re-run the effect that reads it.
  const savedRef = useRef<string | null>(null)
  useEffect(() => {
    if (session && savedRef.current === null) savedRef.current = JSON.stringify(toInput(session))
  }, [session])

  useEffect(() => {
    if (!debounced || debounced === savedRef.current) return

    const input = JSON.parse(debounced) as SessionInput
    savedRef.current = debounced

    void updateSession(input).catch(() => {
      // Let the next edit try again rather than retrying on a loop into a server that just
      // said no. The header shows the failure in the meantime.
      savedRef.current = null
    })
  }, [debounced, updateSession])

  // Thumbnails are separate objects and need signing too, so they go in the same batch —
  // otherwise the strip has a URL for the clip and none for the still it wants to show.
  const allKeys = useMemo(
    () =>
      (draft?.climbs ?? []).flatMap((climb) =>
        (climb.media ?? []).flatMap((m) => (m.posterKey ? [m.key, m.posterKey] : [m.key]))
      ),
    [draft]
  )
  const urls = useMediaUrls(allKeys)

  if (loading && !session) {
    return <div className="h-40 bg-zinc-800 rounded-xl animate-pulse" />
  }

  // Couldn't ask — no signal, or the server is down. Distinct from the session being gone,
  // because the answer here is "try again", not "go back".
  if (unreachable) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">Can't reach your sessions right now.</p>
        <p className="text-sm text-zinc-600 mt-1">Check your connection and try again.</p>
        <button
          onClick={() => void retry()}
          className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 text-sm text-sky-400 hover:bg-zinc-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (notFound || !draft) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">This session is gone.</p>
        <button
          onClick={() => navigate({ to: '/climbing' })}
          className="mt-3 text-sm text-sky-400 hover:text-sky-300"
        >
          Back to Climbing
        </button>
      </div>
    )
  }

  const patch = (changes: Partial<SessionInput>) =>
    setDraft((current) => (current ? { ...current, ...changes } : current))

  const patchClimb = (climb: Climb) =>
    patch({
      climbs: (draft.climbs as Climb[]).map((c) => (c.id === climb.id ? climb : c)),
    })

  const addClimb = () => {
    // Client-side id so the row is addressable before it has ever been saved; the backend
    // adopts it rather than assigning its own.
    const id = crypto.randomUUID()
    patch({ climbs: [...draft.climbs, { id, outcome: 'attempted' as const }] })
    setEditing(id, true)
  }

  const removeClimb = (id: string) => {
    patch({ climbs: draft.climbs.filter((climb) => climb.id !== id) })
    setEditing(id, false)
  }

  const solves = solveCount(draft.climbs as Climb[])
  const unsaved = serialised !== savedRef.current

  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate({ to: '/climbing' })}
          className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 -ml-1 mt-0.5"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setEditingHeader((open) => !open)}
          className="min-w-0 flex-1 text-left"
        >
          <h2 className="truncate text-lg font-semibold text-zinc-100">
            {draft.location || 'Untitled session'}
          </h2>
          <p className="text-xs text-zinc-500">
            {formatSessionDate(draft.date)} · {draft.climbs.length}{' '}
            {draft.climbs.length === 1 ? 'climb' : 'climbs'}
            {solves > 0 && ` · ${solves} solved`}
            {' · '}
            <span className={saveFailed ? 'text-red-400' : 'text-zinc-600'}>
              {saveFailed ? 'save failed' : saving ? 'saving…' : unsaved ? 'unsaved' : 'saved'}
            </span>
          </p>
        </button>

        <button
          onClick={() => setConfirmingDelete(true)}
          aria-label="Delete session"
          className="p-1 text-zinc-600 hover:text-red-400 transition-colors mt-0.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {editingHeader && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 mb-4 space-y-3">
          <LocationInput
            value={draft.location}
            suggestions={locations}
            onChange={(location) => patch({ location })}
          />
          <DatePicker value={draft.date} onChange={(date) => patch({ date })} />
        </div>
      )}

      <div className="mb-4">
        <GradeSystemPicker
          system={draft.gradeSystem}
          kind={draft.gradeKind}
          onSystemChange={(gradeSystem) => patch({ gradeSystem })}
          onKindChange={(gradeKind: GradeKind) => patch({ gradeKind })}
        />
      </div>

      <ul className="space-y-2">
        {(draft.climbs as Climb[]).map((climb, index) => (
          <ClimbRow
            key={climb.id}
            climb={climb}
            index={index}
            gradeKind={draft.gradeKind}
            gradeSystem={draft.gradeSystem}
            urls={urls}
            mediaEnabled={mediaEnabled}
            editing={editingIds.has(climb.id)}
            onChange={patchClimb}
            onDone={() => setEditing(climb.id, false)}
            onEdit={() => setEditing(climb.id, true)}
            onRemove={() => removeClimb(climb.id)}
          />
        ))}
      </ul>

      <button
        onClick={addClimb}
        className="w-full rounded-xl bg-zinc-900 border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:border-sky-400/50 transition-colors mt-3 mb-8"
      >
        + Add climb
      </button>

      <ConfirmDialog
        isOpen={confirmingDelete}
        title="Delete this session?"
        message="The climbs logged in it go too. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          await deleteSession()
          navigate({ to: '/climbing' })
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  )
}
