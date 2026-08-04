interface ScreenshotLoadingOverlayProps {
  onCancel: () => void
  imageCount: number
}

export function ScreenshotLoadingOverlay({ onCancel, imageCount }: ScreenshotLoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-900/95 backdrop-blur-sm">
      {/* Spinner */}
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-zinc-700 rounded-full animate-spin border-t-pink-500" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-pink-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <h2 className="text-xl font-semibold text-zinc-100 mb-2">
        Analyzing Screenshot{imageCount > 1 ? 's' : ''}
      </h2>
      <p className="text-sm text-zinc-400 mb-8">
        {imageCount === 1
          ? 'Extracting expense items from your image...'
          : `Extracting expense items from ${imageCount} images...`}
      </p>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
