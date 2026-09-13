import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ClimbRow } from '../../../components/Climbing/ClimbRow'
import { MediaTray } from '../../../components/Climbing/MediaTray'
import { GradeSystemPicker } from '../../../components/Climbing/GradeSystemPicker'
import { LocationInput } from '../../../components/Climbing/LocationInput'
import { DatePicker } from '../../../components/ExpenseTracker/AddExpenseModal/DatePicker'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { mediaApi } from '../../../services/api'
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

/**
 * What deleting a climb would take with it, or null when the row is empty enough to just
 * go.
 *
 * An outcome and a grade are one tap to put back. Notes typed standing at the wall, and
 * clips already compressed and uploaded, are not — so those are what earn a prompt.
 */
function lossMessage(climb: Pick<Climb, 'description' | 'media'>): string | null {
  const notes = Boolean(climb.description?.trim())
  const count = climb.media?.length ?? 0

  if (!notes && count === 0) return null

  const media = count === 1 ? '1 photo or clip' : `${count} photos and clips`
  if (notes && count > 0) return `Its notes and ${media} go too.`
  if (notes) return 'Its notes go too.'
  return `Its ${media} go too.`
}

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
  /** The climb awaiting a delete confirmation, when it has something worth asking about. */
  const [confirmingRemoveClimb, setConfirmingRemoveClimb] = useState<string | null>(null)

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
    // The climb's own objects go with it. The session record is the only index of what's
    // in the bucket, so a key dropped from the draft without being deleted is stranded
    // there for good — unreachable, and nothing left that could ever find it again.
    const doomed = draft.climbs.find((climb) => climb.id === id)
    for (const item of doomed?.media ?? []) void mediaApi.removeRef(item)

    patch({ climbs: draft.climbs.filter((climb) => climb.id !== id) })
    setEditing(id, false)
  }

  /**
   * Asks first when the row is carrying something. A prompt on every remove would train
   * you to dismiss it without reading, so an unremarkable climb still just goes.
   */
  const requestRemoveClimb = (id: string) => {
    const doomed = draft.climbs.find((climb) => climb.id === id)
    if (doomed && lossMessage(doomed)) {
      setConfirmingRemoveClimb(id)
      return
    }
    removeClimb(id)
  }

  const solves = solveCount(draft.climbs as Climb[])
  const unsaved = serialised !== savedRef.current

  // Non-null exactly when a climb is awaiting confirmation, so the dialog can't stay open
  // for a row that has since lost whatever it was asking about.
  const climbPendingRemoval = draft.climbs.find((climb) => climb.id === confirmingRemoveClimb)
  const pendingLoss = climbPendingRemoval ? lossMessage(climbPendingRemoval) : null

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
            onRemove={() => requestRemoveClimb(climb.id)}
          />
        ))}
      </ul>

      <button
        onClick={addClimb}
        className="w-full rounded-xl bg-zinc-900 border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:border-sky-400/50 transition-colors mt-3"
      >
        + Add climb
      </button>

      {/* Sorts a batch of clips into climbs before anything is uploaded — the tray owns
          that state, and the draft only changes when it is confirmed. */}
      {mediaEnabled && (
        <MediaTray
          climbs={draft.climbs as Climb[]}
          onChangeClimbs={(climbs) => patch({ climbs })}
          onOpenEditing={(ids) =>
            setEditingIds((current) => new Set([...current, ...ids]))
          }
        />
      )}

      <ConfirmDialog
        isOpen={confirmingDelete}
        title="Delete this session?"
        message="The climbs logged in it — and every photo and clip on them — go too. This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={async () => {
          await deleteSession()

          // The session record was the only index of these keys, so they have to go with
          // it — anything left behind is unreachable and nothing could ever find it again.
          // `allKeys` is the same set the page signs URLs for, posters included. Each
          // delete is swallowed: a stray file is invisible and costs pennies, whereas a
          // rejection here would strand the user on a session that no longer exists.
          await Promise.all(allKeys.map((key) => mediaApi.remove(key).catch(() => undefined)))

          navigate({ to: '/climbing' })
        }}
        onCancel={() => setConfirmingDelete(false)}
      />

      <ConfirmDialog
        isOpen={pendingLoss !== null}
        title="Delete this climb?"
        message={pendingLoss ?? ''}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (confirmingRemoveClimb) removeClimb(confirmingRemoveClimb)
          setConfirmingRemoveClimb(null)
        }}
        onCancel={() => setConfirmingRemoveClimb(null)}
      />
    </>
  )
}
