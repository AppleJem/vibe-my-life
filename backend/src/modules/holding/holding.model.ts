import { PutCommand, QueryCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { Holding, CreateHoldingInput, UpdateHoldingInput } from './holding.types.d.js'

/**
 * Holdings share the expense table but not its rows: they are their own item type under
 * the `HOLDING#` sort-key prefix, the way habits use `HABIT_GROUP#` and `HABIT#…#`. That
 * keeps them out of `expenseModel.getAll` (which walks `EXPENSE#`) and out of the backup
 * importer, with no migration — DynamoDB is schemaless below the key.
 *
 * There is no date in the key. A holding is a current balance, not a dated event, so
 * there is nothing to range-slice on and the id alone addresses it.
 */
const holdingKey = (userId: string, holdingId: string) => ({
  PK: `USER#${userId}`,
  SK: `HOLDING#${holdingId}`,
})

export const holdingModel = {
  /** Every holding, in no meaningful order — the client sorts by converted value. */
  async list(userId: string): Promise<Holding[]> {
    const items: Holding[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'HOLDING#',
        },
        ExclusiveStartKey: lastKey,
      }))

      items.push(...((result.Items ?? []) as Holding[]))
      lastKey = result.LastEvaluatedKey
    } while (lastKey)

    return items
  },

  async getById(userId: string, holdingId: string): Promise<Holding | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: holdingKey(userId, holdingId),
    }))

    return (result.Item as Holding) ?? null
  },

  async create(userId: string, input: CreateHoldingInput): Promise<Holding> {
    const now = new Date().toISOString()

    const holding: Holding = {
      id: uuidv4(),
      name: input.name,
      amount: input.amount,
      currency: input.currency,
      // Written unconditionally rather than conditionally spread: an always-present
      // tag and notes means clearing either one is a plain SET, never a REMOVE.
      tag: input.tag ?? '',
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...holdingKey(userId, holding.id),
        ...holding,
      },
    }))

    return holding
  },

  /** Writes only the provided fields. Returns null when the holding doesn't exist. */
  async update(
    userId: string,
    holdingId: string,
    updates: UpdateHoldingInput
  ): Promise<Holding | null> {
    const UPDATABLE = ['name', 'amount', 'currency', 'tag', 'notes'] as const

    const setExpressions = ['#updatedAt = :updatedAt']
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' }
    const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() }

    for (const field of UPDATABLE) {
      const value = updates[field]
      if (value === undefined) continue

      setExpressions.push(`#${field} = :${field}`)
      names[`#${field}`] = field
      values[`:${field}`] = value
    }

    try {
      const result = await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: holdingKey(userId, holdingId),
        UpdateExpression: `SET ${setExpressions.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        // Without this an UpdateCommand on a missing key would happily create a
        // half-formed holding with no id and no createdAt.
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      }))

      return (result.Attributes as Holding) ?? null
    } catch (err: any) {
      if (err?.name === 'ConditionalCheckFailedException') return null
      throw err
    }
  },

  /** True when a holding was there to remove. */
  async remove(userId: string, holdingId: string): Promise<boolean> {
    const result = await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: holdingKey(userId, holdingId),
      ReturnValues: 'ALL_OLD',
    }))

    return Boolean(result.Attributes)
  },
}
