/**
 * Mirrors the responses of `backend/src/modules/media`.
 *
 * The app never uploads through its own server: it asks for a presigned URL, PUTs the file
 * straight to S3, and stores only the key.
 */

export interface UploadTicket {
  key: string
  kind: 'image' | 'video'
  contentType: string
  /** Presigned `PUT`, valid for five minutes. Sign-and-forget — never stored. */
  uploadUrl: string
}
