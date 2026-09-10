/**
 * Creates the DynamoDB table the Cooking app stores recipes in.
 *
 *   pnpm --filter backend exec tsx scripts/create-cooking-table.ts
 *
 * Run once per environment (local creds point at whatever account `.env` names, so running
 * it against production is a matter of which `.env` is loaded). Safe to re-run: a table
 * that already exists is reported and left exactly as it is.
 *
 * The schema matches the expense and habit tables — `PK` / `SK` strings, on-demand billing,
 * no secondary indexes. Recipes are read by prefix within one user's partition, and there is
 * nothing to query them by that the sort key doesn't already order.
 */
// Must precede the db import: `config/env.ts` validates on load, and the server picks this
// up from `index.ts`, which a script never goes through.
import 'dotenv/config'
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { env } from '../src/config/env.js'

const client = new DynamoDBClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
})

const TableName = env.COOKING_TABLE_NAME

async function main() {
  try {
    const existing = await client.send(new DescribeTableCommand({ TableName }))
    console.log(`✓ '${TableName}' already exists (${existing.Table?.TableStatus}). Nothing to do.`)
    return
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'ResourceNotFoundException') throw err
  }

  console.log(`Creating '${TableName}' in ${env.AWS_REGION}…`)

  await client.send(new CreateTableCommand({
    TableName,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    // On-demand: a personal recipe box has no throughput worth provisioning for.
    BillingMode: 'PAY_PER_REQUEST',
  }))

  // Creation is asynchronous, and a table in CREATING state rejects writes — so the script
  // doesn't exit until the app could actually use it.
  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName })

  console.log(`✓ '${TableName}' is ready.`)
}

main().catch((err) => {
  console.error('Failed to create the cooking table:', err)
  process.exit(1)
})
