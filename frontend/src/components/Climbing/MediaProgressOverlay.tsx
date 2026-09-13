import type { MediaPhase } from '../../utils/processMedia'

interface MediaProgressOverlayProps {
  phase: MediaPhase
  /** 0–1 within the current phase. */
  progress: number
}

/**
 * The percentage, the phase caption, and the bar along the bottom — drawn over a local
 * preview while a file is being compressed and uploaded.
 *
 * Shared by a climb's media strip and the media tray, which is the only reason it's a
 * component: the two render it over different things (a 64 px thumbnail, a tray row) but
 * want it to look identical, and this is the part most likely to drift if copied.
 *
 * Two fragments rather than a wrapper element so it can sit inside whatever is already
 * positioned — both callers overlay an absolutely-positioned thumbnail.
 */
export function MediaProgressOverlay({ phase, progress }: MediaProgressOverlayProps) {
  return (
    <>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
        role="progressbar"
        aria-label={phase === 'compressing' ? 'Compressing' : 'Uploading'}
        aria-valuenow={phase === 'queued' ? undefined : Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="text-[11px] font-semibold text-sky-300 tabular-nums leading-none">
          {phase === 'queued' ? '···' : `${Math.round(progress * 100)}%`}
        </span>
        {/* Naming the slow phase is the difference between "working" and "stuck". */}
        {phase === 'compressing' && (
          <span className="text-[8px] uppercase tracking-wide text-zinc-400 leading-none">
            shrinking
          </span>
        )}
      </span>

      {/* Sits on the bottom edge so it reads at a glance even at 64px. Compressing is
          the paler half of the bar, so the two phases are distinguishable. */}
      <span className="absolute bottom-0 inset-x-0 h-1 bg-zinc-900/80">
        <span
          className={`block h-full transition-[width] duration-200 ease-out ${
            phase === 'compressing' ? 'bg-sky-400/50' : 'bg-sky-400'
          }`}
          style={{ width: `${phase === 'queued' ? 0 : progress * 100}%` }}
        />
      </span>
    </>
  )
}
