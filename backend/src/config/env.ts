import { z } from 'zod'

const envSchema = z.object({
  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  // DynamoDB
  DYNAMO_TABLE_NAME: z.string().default('vibe-my-life-expense'),
  // Habits live in their own table — a separate life app, not an expense entity type.
  HABIT_TABLE_NAME: z.string().default('vibe-my-life-habit'),
  // Cooking is the third life app, and gets the same treatment. Create it once with
  // `pnpm --filter backend exec tsx scripts/create-cooking-table.ts`.
  COOKING_TABLE_NAME: z.string().default('vibe-my-life-cooking'),
  // Climbing is the fourth. Create it once with
  // `pnpm --filter backend exec tsx scripts/create-climbing-table.ts`.
  CLIMBING_TABLE_NAME: z.string().default('vibe-my-life-climbing'),

  // Cloudflare R2 — the object store holding climbing photos and clips. Separate
  // credentials from the AWS ones above: those reach DynamoDB, these reach R2, and neither
  // works on the other's service.
  //
  // All four are optional so the server still boots without them: the media endpoints
  // report themselves unavailable rather than the process refusing to start, the same
  // posture the passkey vars take.
  //
  // R2's S3 endpoint is usually https://<account id>.r2.cloudflarestorage.com, which is
  // derived from the account id when S3_API_ENDPOINT is absent. Set it explicitly when
  // Cloudflare hands you a jurisdiction-specific host (`.eu.`, `.fedramp.`), which the
  // plain account-id form does not reach.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  /** The S3 API endpoint exactly as the R2 dashboard prints it. Overrides the derived one. */
  S3_API_ENDPOINT: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(1),
  LOGIN_USERNAME: z.string().min(1),
  LOGIN_PASSWORD: z.string().min(1),

  // Server
  PORT: z.string().default('3001').transform(Number),
  // Comma-separated list of allowed frontend origins
  FRONTEND_URL: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((url) => url.trim().replace(/\/$/, ''))
        .filter(Boolean)
    ),

  // Groq API Key (for ASR)
  GROQ_API_KEY: z.string().optional(),

  // Passkeys (WebAuthn). Both are optional: leave them unset and the passkey
  // endpoints report themselves unavailable rather than the server refusing to
  // boot, so local HTTP development keeps working on password login alone.
  //
  // RP_ID is the registrable domain the passkey is bound to ('jemzhang.com'),
  // never a scheme or a port. A credential created under one RP ID cannot be
  // used under another, so changing this orphans every passkey already enrolled.
  RP_ID: z.string().optional(),
  // Comma-separated origins allowed to present a passkey for RP_ID. Usually just
  // 'https://<RP_ID>', but a second host (an apex plus a preview deploy) can be
  // listed as long as every entry is a subdomain of RP_ID.
  RP_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((url) => url.trim().replace(/\/$/, ''))
        .filter(Boolean)
    ),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data

/**
 * Uploads and playback both go through presigned URLs, which need every part of the R2
 * connection — a bucket with no credentials to sign with is no more usable than no bucket.
 */
export const mediaEnabled = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
)

/** Passkeys need both halves configured; neither is useful alone. */
export const passkeysEnabled = Boolean(env.RP_ID && env.RP_ORIGIN.length > 0)
