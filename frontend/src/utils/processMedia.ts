import { compressImage } from './compressImage'
import { rejectionReason, uploadMedia } from './uploadMedia'
import type { MediaRef } from '../types/climbing'

/**
 * Where a file is on its way to the bucket.
 *
 * Compressing is a phase of its own rather than the first half of "uploading", because for
 * a clip it is the slower half — several seconds of re-encoding before a single byte goes
 * out — and a bar that sat at 0% through all of it would look stuck.
 */
export type MediaPhase = 'queued' | 'compressing' | 'uploading'

/**
 * Some pickers leave `File.type` empty, in which case this is wrong and the file goes
 * through uncompressed. That's the pre-existing behaviour of every caller, and the safe
 * direction to be wrong in: a photo treated as a photo still uploads.
 */
export const isVideoFile = (file: File): boolean => file.type.startsWith('video/')

/**
 * Compress, upload, and upload the thumbnail — for one file, in that order.
 *
 * Shared by the two ways media enters a climb. Adding a file to a climb's own strip runs
 * this immediately; the media tray runs it for each staged file when the batch is
 * confirmed. One implementation, because the ordering and the failure handling are the
 * same in both and are easy to get subtly wrong twice.
 *
 * `onProgress` carries the phase alongside the fraction so the caller can label the slow
 * half without guessing which one is running.
 *
 * Throws on anything that stops the file being stored — an oversized result, a failed
 * upload, a cancel. A thumbnail that fails to upload does *not* throw: a clip with no
 * still still plays, and the strip falls back to a video element for it.
 */
export async function processMediaFile(
  file: File,
  onProgress: (phase: MediaPhase, fraction: number) => void,
  signal?: AbortSignal
): Promise<MediaRef> {
  onProgress('compressing', 0)

  let payload: File
  let poster: Blob | null = null

  if (isVideoFile(file)) {
    // Imported here rather than at the top: the demuxer and muxer are the better part of
    // 60 kB gzipped, and most visits to a session never add a clip.
    const [{ compressVideo }, { posterFromVideo }] = await Promise.all([
      import('./compressVideo'),
      import('./videoPoster'),
    ])

    const compressed = await compressVideo(
      file,
      (progress) => onProgress('compressing', progress),
      signal
    )
    payload = compressed.file
    // A transcode hands back a frame for free. Anything that skipped it — a clip already
    // small enough to leave alone — needs one taken the slow way.
    poster = compressed.poster ?? (await posterFromVideo(payload))
  } else {
    payload = await compressImage(file)
  }

  // Checked after compressing: the raw file off a camera is routinely over a limit the
  // compressed one comes in comfortably under.
  const reason = rejectionReason(payload)
  if (reason) throw new Error(reason)

  onProgress('uploading', 0)

  const ref = await uploadMedia(
    payload,
    (progress) => onProgress('uploading', progress),
    signal
  )

  // Uploaded after the clip, and never allowed to fail it — see the note above.
  let posterKey: string | undefined
  if (poster) {
    try {
      const still = new File([poster], 'poster.jpg', { type: 'image/jpeg' })
      posterKey = (await uploadMedia(still, () => {}, signal)).key
    } catch (err) {
      console.warn('Thumbnail upload failed; falling back to a video element:', err)
    }
  }

  return { ...ref, ...(posterKey && { posterKey }) }
}
