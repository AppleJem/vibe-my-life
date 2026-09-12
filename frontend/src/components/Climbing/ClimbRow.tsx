import { DescriptionField } from './DescriptionField'
import { GradeField } from './GradeField'
import { MediaStrip } from './MediaStrip'
import { OUTCOMES, outcomeMeta } from '../../utils/climbing'
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
  onChange: (climb: Climb) => void
  onRemove: () => void
}

/**
 * One climb, always open and always editable.
 *
 * No sheet and no edit mode: you log a climb between attempts, standing at the wall, and a
 * modal per row would be a tap in and a tap out for every field. Everything writes into the
 * session draft, which autosaves — see the session route.
 */
export function ClimbRow({
  climb,
  index,
  gradeKind,
  gradeSystem,
  urls,
  mediaEnabled,
  onChange,
  onRemove,
}: ClimbRowProps) {
  const meta = outcomeMeta(climb.outcome)
  const media = climb.media ?? []

  const patch = (changes: Partial<Climb>) => onChange({ ...climb, ...changes })

  return (
    <li className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600 tabular-nums w-5 shrink-0">{index + 1}</span>

        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden />

        <select
          value={climb.outcome}
          onChange={(e) => patch({ outcome: e.target.value as ClimbOutcome })}
          aria-label="Outcome"
          className={`flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none ${meta.text}`}
        >
          {OUTCOMES.map((option) => (
            <option key={option.value} value={option.value} className="bg-zinc-800 text-zinc-100">
              {option.label}
            </option>
          ))}
        </select>

        <GradeField
          value={climb.grade ?? ''}
          kind={gradeKind}
          system={gradeSystem}
          onChange={(grade) => patch({ grade })}
        />

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
      </div>

      <DescriptionField
        value={climb.description ?? ''}
        onChange={(description) => patch({ description })}
      />

      {mediaEnabled && (
        <MediaStrip
          items={media}
          urls={urls}
          onChange={(items: MediaRef[]) => patch({ media: items })}
        />
      )}
    </li>
  )
}
