import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { env } from './env.js'

const client = new DynamoDBClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

// One client serves both tables — it is scoped to a region, not to a table.
export const docClient = DynamoDBDocumentClient.from(client)
export const TABLE_NAME = env.DYNAMO_TABLE_NAME
export const HABIT_TABLE_NAME = env.HABIT_TABLE_NAME
