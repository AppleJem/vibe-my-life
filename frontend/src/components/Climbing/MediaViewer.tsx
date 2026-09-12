import { useEffect, useState } from 'react'
import type { MediaRef } from '../../types/climbing'

interface MediaViewerProps {
  items: MediaRef[]
  /** Index within `items` to open on. */
  startIndex: number
  urls: Record<string, string>
  onClose: () => void
}

/**
 * Full-screen playback for one climb's media.
 *
 * Deliberately thin — an image tag and a video tag. The browser's own video controls handle
 * scrubbing, fullscreen and audio better than anything worth writing here, and a clip of a
 * boulder problem needs nothing a player library would add.
 */
export function MediaViewer({ items, startIndex, urls, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(startIndex)
  const current = items[index]

  // Escape closes, arrows page — the viewer is a modal, and a trapped page is a bug.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  if (!current) return null
  const url = urls[current.key]

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between p-4 text-zinc-400 text-sm">
        <span>
          {index + 1} / {items.length}
        </span>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:text-zinc-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stops a tap on the media itself from closing the viewer behind it. */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        {!url ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : current.kind === 'video' ? (
          <video
            key={current.key}
            src={url}
            controls
            playsInline
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <img
            key={current.key}
            src={url}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        )}
      </div>

      {items.length > 1 && (
        <div
          className="flex items-center justify-center gap-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="Previous"
            className="px-4 py-2 text-zinc-300 disabled:opacity-30"
          >
            ‹ Prev
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={index === items.length - 1}
            aria-label="Next"
            className="px-4 py-2 text-zinc-300 disabled:opacity-30"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}
