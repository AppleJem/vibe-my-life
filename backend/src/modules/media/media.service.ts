import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { env } from '../../config/env.js'

/**
 * What the browser is allowed to put in the bucket, and the extension each type is stored
 * under. An allowlist rather than a prefix check (`image/*`) because the extension has to be
 * derivable — and because "whatever the client called it" is not a category worth having in
 * a bucket that serves content back.
 */
const CONTENT_TYPES: Record<string, { kind: 'image' | 'video'; ext: string }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
  'image/heic': { kind: 'image', ext: 'heic' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
  'video/quicktime': { kind: 'video', ext: 'mov' },
  'video/webm': { kind: 'video', ext: 'webm' },
}

/** Long enough to pick a file and push it; short enough that a leaked URL is worthless. */
const UPLOAD_URL_TTL_SECONDS = 300

/**
 * An hour of playback from one page load. `useMediaUrls` on the client refetches at 45
 * minutes, so a URL never goes stale under a viewer who left the page open.
 */
const VIEW_URL_TTL_SECONDS = 3600

/**
 * Cloudflare R2, spoken to over its S3-compatible API — so this is the AWS S3 client
 * pointed at a different endpoint, and everything downstream (presigning included) works
 * unchanged.
 *
 * Three details are R2-specific and all three are load-bearing:
 *
 *  - `region: 'auto'`. R2 has no regions, but SigV4 has to sign *something*; 'auto' is the
 *    literal R2 documents. It is unrelated to `AWS_REGION`, which points DynamoDB at Seoul.
 *  - the endpoint. `S3_API_ENDPOINT` is used verbatim when set, because R2 hands out
 *    jurisdiction-specific hosts (`.eu.`, `.fedramp.`) that the account-id form misses;
 *    deriving it from the account id is only the fallback.
 *  - `forcePathStyle`. The endpoint is the account, not the bucket, so the bucket belongs
 *    in the path. Virtual-host style would resolve to a hostname that doesn't exist.
 *  - the two checksum settings. Recent AWS SDK versions add a CRC32 checksum header to
 *    every upload by default; R2 rejects requests carrying one, and on a *presigned* PUT
 *    the failure surfaces in the browser as an opaque CORS error rather than anything that
 *    names checksums. `WHEN_REQUIRED` turns it off for the calls that don't need it.
 *
 * Lazily created so missing credentials surface as a clear runtime error, not an import
 * crash on a server that would otherwise run fine without media.
 */
/** The endpoint as the dashboard printed it, or the conventional one for the account. */
export function r2Endpoint(): string {
  if (env.S3_API_ENDPOINT) return env.S3_API_ENDPOINT.replace(/\/+$/, '')
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
}

let s3Client: S3Client | null = null
function getS3Client(): S3Client {
  if (!s3Client) {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 is not configured')
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }
  return s3Client
}

function bucket(): string {
  if (!env.R2_BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not configured')
  return env.R2_BUCKET_NAME
}

/** Every object one user owns lives under this prefix, and nothing else does. */
export const userPrefix = (userId: string) => `users/${userId}/`

/**
 * The whole access-control story for media, in one place.
 *
 * There are no per-object ACLs and no ownership table: a key is this user's if and only if
 * it starts with their prefix. Every handler that signs or deletes calls this first, so an
 * id lifted from someone else's session record buys nothing. The traversal check is belt
 * and braces — S3 keys are opaque strings and `..` has no meaning to them — but the prefix
 * comparison is only sound if nothing can be smuggled in to escape it.
 */
export function ownsKey(userId: string, key: string): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 512) return false
  if (key.includes('..') || key.includes('//')) return false
  return key.startsWith(userPrefix(userId))
}

export const mediaService = {
  /** The content types a client may ask to upload, for the error message and for tests. */
  allowedContentTypes: Object.keys(CONTENT_TYPES),

  kindFor(contentType: string): 'image' | 'video' | null {
    return CONTENT_TYPES[contentType]?.kind ?? null
  },

  /**
   * A presigned `PUT` the browser uploads to directly. The file never touches this server —
   * a phone video through Express would be minutes of held memory for no gain.
   *
   * `ContentType` is part of the signature, so the client must send exactly the type it
   * asked for; a mismatch is rejected by S3 rather than silently stored under the wrong one.
   */
  async createUploadUrl(userId: string, contentType: string) {
    const spec = CONTENT_TYPES[contentType]
    if (!spec) throw new Error(`Unsupported content type: ${contentType}`)

    const key = `${userPrefix(userId)}climbing/${uuidv4()}.${spec.ext}`

    const uploadUrl = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS }
    )

    return { key, kind: spec.kind, contentType, uploadUrl }
  },

  /**
   * Read URLs for a whole page's worth of keys at once. Signing is local (no network call
   * per key), so the batch costs one round trip instead of one per thumbnail.
   */
  async createViewUrls(keys: string[]): Promise<Record<string, string>> {
    const client = getS3Client()
    const Bucket = bucket()

    const signed = await Promise.all(
      keys.map(async (key) => [
        key,
        await getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), {
          expiresIn: VIEW_URL_TTL_SECONDS,
        }),
      ] as const)
    )

    return Object.fromEntries(signed)
  },

  async deleteObject(key: string): Promise<void> {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
  },
}
