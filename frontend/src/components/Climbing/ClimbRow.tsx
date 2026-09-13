import { DescriptionField } from './DescriptionField'
import { GradeField } from './GradeField'
import { MediaStrip } from './MediaStrip'
import { OUTCOMES, UNLOGGED_META, formatGrade, outcomeMeta } from '../../utils/climbing'
import type { Climb, ClimbOutcome, GradeKind, MediaRef } from '../../types/climbing'

interface ClimbRowProps {
  climb: Climb
  index: number
  gradeKind: GradeKind
  gradeSystem: string
  /** Presigned read URLs for the whole page, keyed by object key. */
  urls: Record<string, string>
  /** False when the server has no bucket, in which case the strip is hidden entirely. */
  mediaEnabled: boolean
  /** Open for editing, rather than shown as a finished entry. */
  editing: boolean
  onChange: (climb: Climb) => void
  /** Tick — finish editing this climb. Purely a view change; nothing is saved by it. */
  onDone: () => void
  /** Reopen a finished climb. */
  onEdit: () => void
  onRemove: () => void
}

/**
 * One climb, either open for editing or shown as a finished entry.
 *
 * Editing is inline — no sheet and no modal, because you log a climb between attempts,
 * standing at the wall, and a modal per row would be a tap in and a tap out for every
 * field. Ticking one collapses it to a read-only line so the list stays legible as it
 * fills up, and so a stray tap on a session you're only looking at can't change anything.
 *
 * The tick is a view state and nothing more: every keystroke has already been written into
 * the session draft and autosaved by the time it is pressed, so it saves nothing, and
 * losing it on a reload costs nothing either.
 */
export function ClimbRow({
  climb,
  index,
  gradeKind,
  gradeSystem,
  urls,
  mediaEnabled,
  editing,
  onChange,
  onDone,
  onEdit,
  onRemove,
}: ClimbRowProps) {
  const meta = outcomeMeta(climb.outcome)
  const media = climb.media ?? []
  const grade = formatGrade(climb.grade ?? '', gradeSystem, gradeKind)

  const patch = (changes: Partial<Climb>) => onChange({ ...climb, ...changes })

  return (
    <li
      className={`rounded-xl border p-3 space-y-2.5 transition-colors ${
        editing ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-900/60 border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600 tabular-nums w-5 shrink-0">{index + 1}</span>

        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden />

        {editing ? (
          <select
            value={climb.outcome ?? ''}
            onChange={(e) =>
              patch({ outcome: e.target.value ? (e.target.value as ClimbOutcome) : undefined })
            }
            aria-label="Outcome"
            className={`flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none ${meta.text}`}
          >
            {/* First, so "nothing yet" sits above the results rather than among them. */}
            <option value="" className="bg-zinc-800 text-zinc-100">
              {UNLOGGED_META.label}
            </option>
            {OUTCOMES.map((option) => (
              <option key={option.value} value={option.value} className="bg-zinc-800 text-zinc-100">
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span className={`flex-1 min-w-0 truncate text-sm font-medium ${meta.text}`}>
            {meta.label}
          </span>
        )}

        {editing ? (
          <GradeField
            value={climb.grade ?? ''}
            kind={gradeKind}
            system={gradeSystem}
            onChange={(grade) => patch({ grade })}
          />
        ) : (
          grade && (
            <span className="shrink-0 text-sm font-bold text-sky-400 tabular-nums">{grade}</span>
          )
        )}

        {editing ? (
          <>
            <button
              type="button"
              onClick={onDone}
              aria-label={`Finish editing climb ${index + 1}`}
              className="shrink-0 p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove climb ${index + 1}`}
              className="shrink-0 p-1 text-zinc-600 hover:text-red-400 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        ) : (
          /* Deleting is deliberately not reachable from here — reopen the climb first. */
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit climb ${index + 1}`}
            className="shrink-0 p-1 text-zinc-600 hover:text-sky-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <DescriptionField
          value={climb.description ?? ''}
          onChange={(description) => patch({ description })}
        />
      ) : (
        // Nothing at all when there are no notes, rather than an empty box holding the row open.
        climb.description && (
          <p className="text-sm text-zinc-400 whitespace-pre-wrap">{climb.description}</p>
        )
      )}

      {mediaEnabled && (
        <MediaStrip
          items={media}
          urls={urls}
          readOnly={!editing}
          onChange={(items: MediaRef[]) => patch({ media: items })}
        />
      )}
    </li>
  )
}
