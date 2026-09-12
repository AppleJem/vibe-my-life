/**
 * Prepares the Cloudflare R2 bucket the app stores uploaded photos and clips in.
 *
 *   pnpm --filter backend exec tsx scripts/create-media-bucket.ts
 *
 * Run once per environment, with the four `R2_*` values already set in `.env`. Safe to
 * re-run: an existing bucket is left alone, and the CORS rules are re-applied, which is how
 * you pick up a new frontend origin.
 *
 * R2 needs less setting up than S3 did. A bucket is private unless you deliberately attach
 * a public domain to it, so there is no public-access block to apply — every read here goes
 * through a presigned URL minted by `modules/media`, which checks that the key belongs to
 * the caller first. R2 also expires incomplete multipart uploads on its own, so there is no
 * lifecycle rule to configure either.
 *
 * The one thing that does have to be right is CORS: the browser uploads straight to R2, so
 * the bucket has to accept a cross-origin `PUT` from wherever the app is served.
 */
// Must precede the env import: `config/env.ts` validates on load, and the server picks this
// up from `index.ts`, which a script never goes through.
import 'dotenv/config'
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3'
import { env } from '../src/config/env.js'
import { r2Endpoint } from '../src/modules/media/media.service.js'

const Bucket = env.R2_BUCKET_NAME

if (!Bucket || !env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error(
    '❌ R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n' +
    '   and R2_BUCKET_NAME in backend/.env, then run this again.'
  )
  process.exit(1)
}

// Mirrors the client in `modules/media/media.service.ts` — see the comment there for why
// each of these settings is required.
const client = new S3Client({
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

/**
 * Where the browser is allowed to upload from — the same set `server.ts` accepts on its own
 * CORS, since a page that can't reach the API has nothing to upload either. Deduped, because
 * `FRONTEND_URL` usually already names localhost in development.
 */
const allowedOrigins = [...new Set([
  ...env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://vibe-my-life-frontend-sigma.vercel.app',
  'https://jemzhang.com',
])]

async function main() {
  let existed = true

  try {
    await client.send(new HeadBucketCommand({ Bucket }))
    console.log(`✓ '${Bucket}' already exists.`)
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    const name = (err as { name?: string }).name

    if (status === 403) {
      console.error(
        `❌ R2 refused the request for '${Bucket}'. The API token needs Object Read & Write\n` +
        '   on this bucket (or on all buckets in the account).'
      )
      process.exit(1)
    }

    if (name !== 'NotFound' && name !== 'NoSuchBucket' && status !== 404) throw err
    existed = false

    console.log(`Creating '${Bucket}'…`)
    await client.send(new CreateBucketCommand({ Bucket }))
  }

  // PUT for the presigned upload, GET/HEAD for playback and for a video element's range
  // requests.
  const corsRules = [{
    AllowedOrigins: allowedOrigins,
    AllowedMethods: ['PUT', 'GET', 'HEAD'],
    AllowedHeaders: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3000,
  }]

  try {
    await client.send(new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: { CORSRules: corsRules },
    }))
    console.log(`✓ CORS allows: ${allowedOrigins.join(', ')}`)
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status !== 403) throw err

    // Changing bucket configuration needs an *Admin* Read & Write token; the app itself
    // only ever needs Object Read & Write. Rather than asking for a broader token than the
    // server has any use for, print the policy and let it be pasted in once by hand.
    console.log(
      '\n⚠ This API token can read and write objects but not change bucket settings,\n' +
      '  so CORS was left alone. Uploads from a browser will fail until it is set.\n' +
      '\n  Paste this into the Cloudflare dashboard — R2 → ' + Bucket + ' → Settings →\n' +
      '  CORS policy → Edit:\n'
    )
    console.log(JSON.stringify(corsRules, null, 2))
    console.log('\n  (Or re-run this with an Admin Read & Write token to apply it here.)')
  }

  console.log(`\n✓ '${Bucket}' is ready${existed ? '' : ' (newly created)'}.`)
}

main().catch((err) => {
  console.error('Failed to set up the media bucket:', err)
  process.exit(1)
})
