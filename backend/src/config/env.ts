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

/** Passkeys need both halves configured; neither is useful alone. */
export const passkeysEnabled = Boolean(env.RP_ID && env.RP_ORIGIN.length > 0)
