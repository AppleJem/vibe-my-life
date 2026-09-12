import { useEffect, useRef, useState } from 'react'
import { mediaApi } from '../../services/api'
import { rejectionReason, sourceRejectionReason, uploadMedia } from '../../utils/uploadMedia'
import { compressImage } from '../../utils/compressImage'
import { MediaViewer } from './MediaViewer'
import type { MediaRef } from '../../types/climbing'

interface MediaStripProps {
  items: MediaRef[]
  /** Presigned read URLs, keyed by object key — from `useMediaUrls` on the page. */
  urls: Record<string, string>
  /** Thumbnails still open in the viewer; only adding and removing goes away. */
  readOnly?: boolean
  onChange: (items: MediaRef[]) => void
}

/**
 * A file on its way in, shown from a local preview so the thumbnail appears instantly.
 *
 * Compressing is its own phase rather than part of the upload, because for a clip it is
 * the slower half — several seconds of re-encoding before a single byte goes out — and a
 * bar that sat at 0% through all of it would look stuck.
 */
interface Pending {
  id: string
  previewUrl: string
  isVideo: boolean
  phase: 'queued' | 'compressing' | 'uploading'
  /** 0–1 within the current phase. */
  progress: number
  abort: AbortController
}

/**
 * The photos and clips on one climb, as a row of thumbnails plus an add tile.
 *
 * Bytes go straight from the browser to S3; this component only ever handles keys. A file
 * shows as a thumbnail the instant it's picked, rendered from a local object URL, and is
 * swapped for the stored reference when the upload lands — so a slow phone video doesn't
 * make the row look like nothing happened.
 */
export function MediaStrip({ items, urls, readOnly = false, onChange }: MediaStripProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)

  // Object URLs are a leak until revoked, and the previews outlive individual renders.
  const previewUrls = useRef<string[]>([])
  useEffect(() => () => previewUrls.current.forEach(URL.revokeObjectURL), [])

  // Lets the upload loop below write onto the newest list: `items` is a render behind once
  // the first upload has landed and the parent has re-rendered.
  const itemsRef = useRef(items)
  itemsRef.current = items

  const handleFiles = async (files: File[]) => {
    setError(null)

    const rejected = files.map(sourceRejectionReason).filter((r): r is string => r !== null)
    if (rejected.length > 0) setError(rejected[0])

    const accepted = files.filter((file) => sourceRejectionReason(file) === null)
    if (accepted.length === 0) return

    const tickets = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.push(previewUrl)
      return {
        file,
        entry: {
          id: crypto.randomUUID(),
          previewUrl,
          isVideo: file.type.startsWith('video/'),
          phase: 'queued' as const,
          progress: 0,
          abort: new AbortController(),
        },
      }
    })

    setPending((current) => [...current, ...tickets.map((t) => t.entry)])

    const update = (id: string, changes: Partial<Pending>) =>
      setPending((current) => current.map((p) => (p.id === id ? { ...p, ...changes } : p)))

    // Sequential rather than parallel: a handful of phone videos at once saturates the
    // connection and every one of them crawls, which reads as the app being broken. It also
    // means one honest progress bar at a time instead of several fighting for bandwidth.
    for (const { file, entry } of tickets) {
      if (entry.abort.signal.aborted) {
        setPending((current) => current.filter((p) => p.id !== entry.id))
        continue
      }

      try {
        // Compress first, then check the ceiling: the raw file off a camera is routinely
        // over a limit the compressed one comes in comfortably under.
        update(entry.id, { phase: 'compressing', progress: 0 })

        let payload: File
        let poster: Blob | null = null

        if (entry.isVideo) {
          // Imported here rather than at the top: the demuxer and muxer are the better part
          // of 60 kB gzipped, and most visits to a session never add a clip.
          const [{ compressVideo }, { posterFromVideo }] = await Promise.all([
            import('../../utils/compressVideo'),
            import('../../utils/videoPoster'),
          ])

          const compressed = await compressVideo(
            file,
            (progress) => update(entry.id, { progress }),
            entry.abort.signal
          )
          payload = compressed.file
          // A transcode hands back a frame for free. Anything that skipped it — a clip
          // already small enough to leave alone — needs one taken the slow way.
          poster = compressed.poster ?? (await posterFromVideo(payload))
        } else {
          payload = await compressImage(file)
        }

        const reason = rejectionReason(payload)
        if (reason) {
          setError(reason)
          continue
        }

        update(entry.id, { phase: 'uploading', progress: 0 })

        const ref = await uploadMedia(
          payload,
          (progress) => update(entry.id, { progress }),
          entry.abort.signal
        )

        // Uploaded after the clip, and never allowed to fail it: a video with no thumbnail
        // still plays, and the strip falls back to a video element for it.
        let posterKey: string | undefined
        if (poster) {
          try {
            const still = new File([poster], 'poster.jpg', { type: 'image/jpeg' })
            posterKey = (await uploadMedia(still, () => {}, entry.abort.signal)).key
          } catch (err) {
            console.warn('Thumbnail upload failed; falling back to a video element:', err)
          }
        }

        onChange([...itemsRef.current, { ...ref, ...(posterKey && { posterKey }) }])
      } catch (err) {
        // A cancel is a choice, not a failure — the thumbnail simply goes away.
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Upload failed')
        }
      } finally {
        setPending((current) => current.filter((p) => p.id !== entry.id))
      }
    }
  }

  const removeItem = (item: MediaRef) => {
    onChange(items.filter((i) => i.id !== item.id))
    // Fire and forget: the record no longer points at either object, and a failed delete is
    // a stray file rather than a broken climb.
    void mediaApi.remove(item.key).catch(() => undefined)
    if (item.posterKey) void mediaApi.remove(item.posterKey).catch(() => undefined)
  }

  if (readOnly && items.length === 0) return null

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => (
          <div key={item.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setViewing(index)}
              className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 block"
            >
              {(() => {
                // A stored still is preferred for a video and required on iOS, which won't
                // paint a frame of a `<video>` until it plays. The video element remains the
                // fallback for clips uploaded before thumbnails existed.
                const still = item.posterKey ? urls[item.posterKey] : undefined
                if (still) return <img src={still} alt="" className="w-full h-full object-cover" />

                const source = urls[item.key]
                if (!source) {
                  return (
                    <span className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                      …
                    </span>
                  )
                }

                return item.kind === 'video' ? (
                  <video
                    // The fragment asks for a frame two seconds in rather than the poster
                    // frame the file doesn't have — the one thing that coaxes a still out
                    // of Safari without playing the clip.
                    src={`${source}#t=2`}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img src={source} alt="" className="w-full h-full object-cover" />
                )
              })()}
            </button>

            {item.kind === 'video' && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white text-[10px]">
                  ▶
                </span>
              </span>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label="Remove"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400 text-xs leading-none hover:text-red-400"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {pending.map((p) => (
          <div
            key={p.id}
            className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700"
          >
            {p.isVideo ? (
              <video src={p.previewUrl} className="w-full h-full object-cover opacity-30" muted />
            ) : (
              <img src={p.previewUrl} alt="" className="w-full h-full object-cover opacity-30" />
            )}

            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
              role="progressbar"
              aria-label={p.phase === 'compressing' ? 'Compressing' : 'Uploading'}
              aria-valuenow={p.phase === 'queued' ? undefined : Math.round(p.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span className="text-[11px] font-semibold text-sky-300 tabular-nums leading-none">
                {p.phase === 'queued' ? '···' : `${Math.round(p.progress * 100)}%`}
              </span>
              {/* Naming the slow phase is the difference between "working" and "stuck". */}
              {p.phase === 'compressing' && (
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
                  p.phase === 'compressing' ? 'bg-sky-400/50' : 'bg-sky-400'
                }`}
                style={{ width: `${p.phase === 'queued' ? 0 : p.progress * 100}%` }}
              />
            </span>

            <button
              type="button"
              onClick={() => p.abort.abort()}
              aria-label="Cancel upload"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 text-zinc-400 text-xs leading-none hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))}

        {!readOnly && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            aria-label="Add a photo or clip"
            className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-700 text-zinc-600 hover:text-sky-400 hover:border-sky-400/50 transition-colors text-xl"
          >
            +
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}

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

      {viewing !== null && (
        <MediaViewer
          items={items}
          startIndex={viewing}
          urls={urls}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
