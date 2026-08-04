import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { Category, ExpenseMetadata, MetadataPatch } from './metadata.types.d.js'

export const DEFAULT_CATEGORIES: Category[] = [
  { name: '🍜 Food', subcategories: [] },
  { name: '🚗 Transport', subcategories: [] },
  { name: '🏠 Household', subcategories: [] },
  { name: '👕 Apparel', subcategories: [] },
  { name: '⚽ Sports', subcategories: [] },
  { name: '📚 Education', subcategories: [] },
  { name: '🎁 Gift', subcategories: [] },
  { name: '🛒 Shopping', subcategories: [] },
  { name: '🏥 Medical', subcategories: [] },
  { name: '💕 Dating', subcategories: [] },
  { name: '✈️ Travel', subcategories: [] },
  { name: '📦 Other', subcategories: [] },
]

export const DEFAULT_BASE_CURRENCY = 'SGD'

const toMetadata = (item: Record<string, unknown>): ExpenseMetadata => ({
  categories: (item.categories ?? []) as Category[],
  baseCurrency: (item.baseCurrency ?? DEFAULT_BASE_CURRENCY) as string,
  currencies: (item.currencies ?? []) as string[],
  updatedAt: (item.updatedAt ?? '') as string,
})

export const metadataModel = {
  async get(userId: string): Promise<ExpenseMetadata | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'META',
      },
    }))

    if (!result.Item) return null

    return toMetadata(result.Item)
  },

  /**
   * Writes only the provided fields, so saving currency settings can't clobber
   * categories (and vice versa). Creates the META item if it doesn't exist yet.
   */
  async patch(userId: string, fields: MetadataPatch): Promise<ExpenseMetadata> {
    const setExpressions = ['#updatedAt = :updatedAt']
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' }
    const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() }

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue
      setExpressions.push(`#${key} = :${key}`)
      names[`#${key}`] = key
      values[`:${key}`] = value
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'META',
      },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }))

    return toMetadata(result.Attributes ?? {})
  },
}
