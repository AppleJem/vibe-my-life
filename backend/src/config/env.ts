import { z } from 'zod'

const envSchema = z.object({
  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),

  // DynamoDB
  DYNAMO_TABLE_NAME: z.string().default('vibe-my-life-expense'),

  // Auth
  JWT_SECRET: z.string().min(1),
  LOGIN_USERNAME: z.string().min(1),
  LOGIN_PASSWORD: z.string().min(1),

  // Server
  PORT: z.string().default('3001').transform(Number),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
