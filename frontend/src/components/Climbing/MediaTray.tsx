import { useEffect, useRef, useState } from 'react'
import { MediaProgressOverlay } from './MediaProgressOverlay'
import { sourceRejectionReason } from '../../utils/uploadMedia'
import { isVideoFile, processMediaFile, type MediaPhase } from '../../utils/processMedia'
import type { Climb } from '../../types/climbing'

/** How many files can be staged before a Confirm is needed to add more. */
const MAX_STAGED = 5

/** Matches the server's ceiling in `climbSchema`; exceeding it is a 400, not a trim. */
const MAX_MEDIA_PER_CLIMB = 20

/** Marks a target that isn't a climb yet. The suffix is its position in the chip strip. */
const NEW_PREFIX = 'NEW:'

interface MediaTrayProps {
  /** Current draft climbs, for the chips' numbering and for appending media to. */
  climbs: Climb[]
  /** Replaces the whole array — the same call the page already makes to edit a row. */
  onChangeClimbs: (climbs: Climb[]) => void
  /** Opens climbs for editing, so a freshly created one is ready to be filled in. */
  onOpenEditing: (ids: string[]) => void
}

/**
 * A file picked but not yet uploaded.
 *
 * Deliberately not a `MediaRef`: there is no `key` until the file has been through the
 * bucket, so a staged file cannot live in `Climb.media` and must never be autosaved. The
 * tray holds `File`s, and the session draft only changes when Confirm is pressed.
 */
interface StagedFile {
  id: string
  file: File
  /** Local object URL, for the thumbnail and for the viewer. */
  previewUrl: string
  isVideo: boolean
  /** A still taken locally, because iOS won't paint a frame of a `<video>` that hasn't played. */
  posterUrl: string | null
  /** A real climb id, or `NEW:<n>`. Null while undecided, which blocks Confirm. */
  target: string | null
  phase: MediaPhase
  progress: number
  error: string | null
}

/**
 * Picks up to five photos and clips, lets you say which climb each belongs to, and uploads
 * the lot on Confirm.
 *
 * Nothing is compressed or uploaded on pick — that is the whole point. Coming back from a
 * session with five clips, you sort them first and then let the phone get on with it once,
 * rather than waiting on an upload per climb before you know what you've got.
 */
export function MediaTray({ climbs, onChangeClimbs, onOpenEditing }: MediaTrayProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  // Object URLs are a leak until revoked, and they outlive individual renders.
  const createdUrls = useRef<string[]>([])
  useEffect(() => () => createdUrls.current.forEach(URL.revokeObjectURL), [])

  const track = (url: string) => {
    createdUrls.current.push(url)
    return url
  }

  // Refs so the upload loop reads the newest values: `climbs` is a render behind as soon
  // as the first append lands and the parent re-renders.
  const climbsRef = useRef(climbs)
  climbsRef.current = climbs
  const stagedRef = useRef(staged)
  stagedRef.current = staged
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const abortRef = useRef<AbortController | null>(null)
  const nextGroup = useRef(1)

  /**
   * A group no file points at has nothing to attach to, so it goes rather than lingering
   * as an empty `N2` chip on every row. Returning the same array when nothing changed lets
   * React bail out — this runs on every progress tick too.
   */
  useEffect(() => {
    setGroups((current) => {
      const next = current.filter((group) => staged.some((file) => file.target === group))
      return next.length === current.length ? current : next
    })
  }, [staged])

  const update = (id: string, changes: Partial<StagedFile>) =>
    setStaged((current) => current.map((f) => (f.id === id ? { ...f, ...changes } : f)))

  const drop = (id: string) => {
    setStaged((current) => {
      const gone = current.find((f) => f.id === id)
      if (gone) {
        URL.revokeObjectURL(gone.previewUrl)
        if (gone.posterUrl) URL.revokeObjectURL(gone.posterUrl)
      }
      return current.filter((f) => f.id !== id)
    })
  }

  const handleFiles = async (files: File[]) => {
    setError(null)

    const rejected = files.map(sourceRejectionReason).filter((r): r is string => r !== null)
    if (rejected.length > 0) setError(rejected[0])

    const accepted = files.filter((file) => sourceRejectionReason(file) === null)
    if (accepted.length === 0) return

    const room = MAX_STAGED - stagedRef.current.length
    if (room <= 0) {
      setError(`Only ${MAX_STAGED} at a time — confirm these first.`)
      return
    }

    const taken = accepted.slice(0, room)
    if (accepted.length > room) {
      setError(`Only ${MAX_STAGED} at a time — ${accepted.length - room} not added.`)
    }

    const entries: StagedFile[] = taken.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: track(URL.createObjectURL(file)),
      isVideo: isVideoFile(file),
      posterUrl: null,
      target: null,
      phase: 'queued',
      progress: 0,
      error: null,
    }))

    setStaged((current) => [...current, ...entries])

    // A still per clip, taken from the local file — uploads nothing, and without it every
    // video chip is a black box on iOS until the clip has played.
    const { posterFromVideo } = await import('../../utils/videoPoster')
    for (const entry of entries.filter((e) => e.isVideo)) {
      const blob = await posterFromVideo(entry.file).catch(() => null)
      if (blob) update(entry.id, { posterUrl: track(URL.createObjectURL(blob)) })
    }
  }

  const addGroup = (fileId: string) => {
    const group = `${NEW_PREFIX}${nextGroup.current++}`
    setGroups((current) => [...current, group])
    update(fileId, { target: group, error: null })
  }

  /** Tapping the chip a file is already on clears it, so a mis-tap is one more tap. */
  const toggleTarget = (fileId: string, target: string) => {
    const current = stagedRef.current.find((f) => f.id === fileId)
    update(fileId, { target: current?.target === target ? null : target, error: null })
  }

  const clear = () => {
    abortRef.current?.abort()
    setStaged([])
    setGroups([])
    setError(null)
  }

  const confirm = async () => {
    const queued = stagedRef.current
    if (queued.some((f) => !f.target)) return

    // The server rejects a climb with more than 20 media outright, so refuse here rather
    // than upload four clips and then lose the whole save.
    const added = new Map<string, number>()
    for (const file of queued) {
      if (file.target) added.set(file.target, (added.get(file.target) ?? 0) + 1)
    }
    for (const [target, count] of added) {
      if (target.startsWith(NEW_PREFIX)) continue
      const climb = climbsRef.current.find((c) => c.id === target)
      if (climb && (climb.media?.length ?? 0) + count > MAX_MEDIA_PER_CLIMB) {
        setError(`A climb holds at most ${MAX_MEDIA_PER_CLIMB} photos and clips.`)
        return
      }
    }

    setError(null)
    setRunning(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // New climbs come into being here, not when the chip is added: staging is meant to
      // change nothing about the session until it's confirmed, and an abandoned tray would
      // otherwise leave empty nameless rows behind.
      const created: Climb[] = []
      const realId = new Map<string, string>()
      for (const group of groupsRef.current) {
        const id = crypto.randomUUID()
        realId.set(group, id)
        created.push({ id })
      }

      if (created.length > 0) {
        const next = [...climbsRef.current, ...created]
        climbsRef.current = next
        onChangeClimbs(next)
        onOpenEditing(created.map((c) => c.id))

        // The groups are real climbs now, so retarget the staged files onto them. Without
        // this, Confirm pressed again after a failure would create a second copy of every
        // new climb while the first one sits there holding the clips that did upload.
        setStaged((current) =>
          current.map((file) =>
            file.target && realId.has(file.target)
              ? { ...file, target: realId.get(file.target)! }
              : file
          )
        )
        setGroups([])
      }

      // Sequential, never parallel: a handful of phone videos at once saturates the
      // connection and every one crawls, which reads as the app being broken.
      for (const file of queued) {
        if (controller.signal.aborted) break

        const target = file.target!
        const climbId = target.startsWith(NEW_PREFIX) ? realId.get(target) : target
        if (!climbId) continue

        try {
          const ref = await processMediaFile(
            file.file,
            (phase, progress) => update(file.id, { phase, progress }),
            controller.signal
          )

          // Appended as each one lands, so a failure halfway keeps the ones that worked.
          const next = climbsRef.current.map((climb) =>
            climb.id === climbId ? { ...climb, media: [...(climb.media ?? []), ref] } : climb
          )
          climbsRef.current = next
          onChangeClimbs(next)
          drop(file.id)
        } catch (err) {
          // A cancel is a choice, not a failure — the row just goes away.
          if (err instanceof DOMException && err.name === 'AbortError') {
            drop(file.id)
            continue
          }
          // Left in the tray with its error, so Confirm can be pressed again for just these.
          update(file.id, { error: err instanceof Error ? err.message : 'Upload failed' })
        }
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const assigned = staged.filter((f) => f.target).length
  const usedGroups = groups.filter((g) => staged.some((f) => f.target === g))
  const allAssigned = staged.length > 0 && assigned === staged.length

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={staged.length >= MAX_STAGED || running}
        className="w-full rounded-xl bg-zinc-900 border border-dashed border-zinc-700 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:border-sky-400/50 transition-colors disabled:opacity-40"
      >
        + Add photos or clips
      </button>

      {staged.length > 0 && (
        <ul className="mt-2 space-y-2">
          {staged.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-2"
            >
              <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                {item.isVideo ? (
                  item.posterUrl ? (
                    <img src={item.posterUrl} alt="" className="w-full h-full object-cover brightness-50 opacity-30" />
                  ) : (
                    <video
                      src={item.previewUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover brightness-50"
                    />
                  )
                ) : (
                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                )}

                {running && <MediaProgressOverlay phase={item.phase} progress={item.progress} />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-500">{item.file.name}</p>

                <div className="mt-1 flex flex-wrap gap-1">
                  {climbs.map((climb, index) => (
                    <Chip
                      key={climb.id}
                      label={String(index + 1)}
                      active={item.target === climb.id}
                      disabled={running}
                      onClick={() => toggleTarget(item.id, climb.id)}
                    />
                  ))}

                  {groups.map((group, index) => (
                    <Chip
                      key={group}
                      label={`N${index + 1}`}
                      active={item.target === group}
                      disabled={running}
                      onClick={() => toggleTarget(item.id, group)}
                    />
                  ))}

                  <button
                    type="button"
                    onClick={() => addGroup(item.id)}
                    disabled={running}
                    aria-label={`Put ${item.file.name} on a new climb`}
                    className="h-7 min-w-[1.75rem] px-1.5 rounded-lg border border-dashed border-zinc-700 text-xs font-semibold text-zinc-500 hover:border-sky-400/50 hover:text-sky-400 transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                {item.error && <p className="mt-1 text-xs text-red-400">{item.error}</p>}
              </div>

              <button
                type="button"
                onClick={() => drop(item.id)}
                disabled={running}
                aria-label={`Remove ${item.file.name}`}
                className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {staged.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!allAssigned || running}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-zinc-950 text-sm font-semibold disabled:opacity-40 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 transition-colors"
          >
            {running ? 'Uploading…' : `Confirm${allAssigned ? '' : ` (${assigned}/${staged.length})`}`}
          </button>

          <button
            type="button"
            onClick={running ? () => abortRef.current?.abort() : clear}
            className="px-3 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            {running ? 'Cancel' : 'Clear'}
          </button>
        </div>
      )}

      {staged.length > 0 && (
        <p className="mt-1.5 text-xs text-zinc-600">
          {assigned} of {staged.length} assigned
          {usedGroups.length > 0 &&
            ` · will add ${usedGroups.length} new ${usedGroups.length === 1 ? 'climb' : 'climbs'}`}
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Reset first: picking the same file twice in a row fires no change event
          // otherwise, which reads as the button being dead.
          e.target.value = ''
          void handleFiles(files)
        }}
      />
    </div>
  )
}

interface ChipProps {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}

/** One climb in a row's chip strip. Tapping the active one clears the assignment. */
function Chip({ label, active, disabled, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`h-7 min-w-[1.75rem] px-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors disabled:opacity-40 ${active
        ? 'bg-sky-400 text-zinc-950'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
    >
      {label}
    </button>
  )
}
