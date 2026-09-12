/**
 * Shrinks a photo before it is uploaded.
 *
 * A modern phone camera writes 4–12 MB per shot, and none of that detail survives being
 * looked at on a phone screen to see which holds were used. Resizing to 1080p and
 * re-encoding as JPEG typically cuts a photo by 10–20×, which is the difference between a
 * session's worth of media uploading over gym wifi and not.
 *
 * Everything here is best-effort: anything that fails falls back to the original file, so a
 * format the browser can't decode is uploaded as-is rather than lost.
 */

/** Long edge, in pixels. Enough to read a wall; nowhere near what the camera produced. */
const MAX_DIMENSION = 1920

/** Visibly lossy only if you go looking. Holds and tape stay perfectly legible. */
const JPEG_QUALITY = 0.75

/**
 * Below this there is nothing worth reclaiming, and re-encoding a small image can easily
 * make it bigger.
 */
const SKIP_BELOW_BYTES = 400 * 1024

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * Returns a compressed JPEG, or the original file when compressing wasn't possible or
 * wasn't worth it. Never throws.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < SKIP_BELOW_BYTES) return file

  try {
    // `from-image` applies the EXIF orientation, so a photo taken sideways doesn't come out
    // of the canvas rotated — the tag is dropped by the re-encode, so it has to be baked in.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await canvasToBlob(canvas, JPEG_QUALITY)
    // A small or already-efficient image can come out larger; keeping the original is
    // strictly better than uploading a worse *and* bigger file.
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    // HEIC on a browser that can't decode it lands here, as does an image too large to
    // rasterise. Uploading the original is the right answer for both.
    return file
  }
}
