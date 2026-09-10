interface ParsingOverlayProps {
  /** How many photos went up, so the wait is accounted for. */
  imageCount: number
  onCancel: () => void
}

/**
 * Covers the screen while the recipe is being read. A parse takes long enough that a spinner
 * alone reads as a hang, so it says what is being done and stays cancellable throughout —
 * the request carries an abort signal, and nothing has been stored yet either way.
 */
export function ParsingOverlay({ imageCount, onCancel }: ParsingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/90 px-6">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />

      <p className="mt-6 text-sm font-medium text-zinc-100">
        {imageCount > 0
          ? `Reading ${imageCount === 1 ? 'the photo' : `${imageCount} photos`}…`
          : 'Reading the recipe…'}
      </p>
      <p className="mt-1 text-center text-xs text-zinc-500">
        Pulling out the ingredients with their amounts, and the steps with their timings.
      </p>

      <button
        onClick={onCancel}
        className="mt-8 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
      >
        Cancel
      </button>
    </div>
  )
}
