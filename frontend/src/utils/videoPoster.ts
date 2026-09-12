/**
 * A still frame from a video, taken with a `<video>` element and a canvas.
 *
 * The fallback path. A transcoded clip gets its thumbnail off the encode canvas for free
 * (see `compressVideo`), so this is only reached by a clip that skipped transcoding —
 * one already small enough to leave alone, or a browser without WebCodecs.
 *
 * Worth the trouble because iOS will not paint a frame of a `<video>` until playback
 * starts: a video element used directly as a thumbnail is a black box on a phone. Drawing
 * a seeked frame to a canvas does work there, which is what this relies on.
 */

/** Two seconds in — past whatever the phone was doing while being propped up. */
const POSTER_TIME_SECONDS = 2

/** Long edge of the stored thumbnail. Four times the 64px it renders at, for retina. */
const POSTER_SIZE = 256

/** Seeking a large clip can stall indefinitely; a thumbnail is never worth hanging for. */
const TIMEOUT_MS = 10_000

/** Returns a JPEG still, or null when one couldn't be taken. Never throws. */
export async function posterFromVideo(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('video/')) return null

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')

  // `muted` and `playsInline` together are what keep iOS from demanding a user gesture or
  // taking the video fullscreen; `preload` is what makes it fetch frames at all.
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  try {
    return await withTimeout(capture(video), TIMEOUT_MS)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }
}

function capture(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    video.onerror = () => reject(new Error('Video could not be read'))

    video.onloadedmetadata = () => {
      const { videoWidth: w, videoHeight: h, duration } = video
      if (!w || !h) return reject(new Error('Video has no dimensions'))

      // A clip shorter than the target uses its midpoint. Nudged off the very end, which
      // on some files decodes to a blank frame.
      video.currentTime = Number.isFinite(duration)
        ? Math.min(POSTER_TIME_SECONDS, Math.max(0, duration / 2))
        : 0
    }

    video.onseeked = () => {
      const scale = Math.min(1, POSTER_SIZE / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No 2D context'))

      // The element applies the container's rotation on its own, so what lands here is
      // already the right way up — unlike a raw decoded frame.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.72)
    }
  })
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}
