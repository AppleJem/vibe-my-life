import { mediaApi } from '../services/api'
import type { MediaRef } from '../types/climbing'

/**
 * What may be *uploaded*. Photos and clips are both compressed to 1080p first, so in normal
 * use nothing comes close to these — they are backstops for a file that failed to compress
 * (an undecodable HEIC, a codec with no hardware encoder).
 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024

/**
 * What may be *opened*. Compressing means holding the decoded file in memory, so a clip
 * beyond this is refused before the attempt rather than taking the tab down with it.
 * Comfortably above anything a phone produces for a boulder problem.
 */
export const MAX_SOURCE_VIDEO_BYTES = 600 * 1024 * 1024
export const MAX_SOURCE_IMAGE_BYTES = 100 * 1024 * 1024

/**
 * `File.type` is empty for some pickers, and iOS reports `.mov` inconsistently; fall back
 * to the extension so a valid file isn't turned away over a missing header.
 */
function contentTypeOf(file: File): string {
  if (file.type) return file.type

  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'heic': return 'image/heic'
    case 'mp4': return 'video/mp4'
    case 'mov': return 'video/quicktime'
    case 'webm': return 'video/webm'
    default: return ''
  }
}

const tooLarge = (file: File, limit: number) =>
  `${file.name} is too large (max ${Math.round(limit / 1024 / 1024)} MB)`

/**
 * Whether the file is worth opening at all — checked before compressing, so an
 * unrecognised or absurdly large file costs nothing.
 */
export function sourceRejectionReason(file: File): string | null {
  const contentType = contentTypeOf(file)
  if (!contentType) return `${file.name}: unrecognised file type`

  const limit = contentType.startsWith('video/')
    ? MAX_SOURCE_VIDEO_BYTES
    : MAX_SOURCE_IMAGE_BYTES

  return file.size > limit ? tooLarge(file, limit) : null
}

/** The reason a file can't be uploaded, or null when it can. Checked after compressing. */
export function rejectionReason(file: File): string | null {
  const contentType = contentTypeOf(file)
  if (!contentType) return `${file.name}: unrecognised file type`

  const limit = contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES

  return file.size > limit ? tooLarge(file, limit) : null
}

/**
 * A presigned `PUT`, over `XMLHttpRequest` rather than `fetch`.
 *
 * `fetch` has no way to report how much of a request body has gone out — the streaming
 * upload half of the spec isn't usable here — and a phone video is exactly the case where
 * a spinner that could mean "10% done" or "stalled" is worth the older API.
 *
 * Deliberately not the axios `api` instance either: its `Authorization` header would be an
 * unsigned header on a presigned request, and R2 rejects the whole thing. The `Content-Type`
 * must be exactly the one the URL was signed for, which is why it comes from the ticket
 * rather than being read off the file again.
 */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)

    xhr.upload.onprogress = (event) => {
      // `lengthComputable` is false on the odd platform; leaving progress where it was
      // shows an indeterminate bar rather than a number that jumps around.
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    }

    // The last byte being sent isn't the same as R2 having accepted it, so the bar parks
    // just short of full until the response lands.
    xhr.upload.onload = () => onProgress(0.99)

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Upload failed — check your connection'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))

    if (signal) {
      if (signal.aborted) return xhr.abort()
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(file)
  })
}

/**
 * Uploads one file and returns the reference to store on the climb.
 *
 * `onProgress` is called with 0–1 as the bytes go out, so the caller can show how far along
 * a clip is rather than only that something is happening.
 */
export async function uploadMedia(
  file: File,
  onProgress: (fraction: number) => void = () => {},
  signal?: AbortSignal
): Promise<MediaRef> {
  const ticket = await mediaApi.uploadUrl(contentTypeOf(file))

  await putWithProgress(ticket.uploadUrl, file, ticket.contentType, onProgress, signal)

  return {
    // The backend assigns real ids on save; this one only has to be unique in the draft.
    id: crypto.randomUUID(),
    key: ticket.key,
    kind: ticket.kind,
    contentType: ticket.contentType,
  }
}
