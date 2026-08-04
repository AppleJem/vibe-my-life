import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from '../../config/db.js'
import type { Category, ExpenseMetadata } from './metadata.types.d.js'

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

    return {
      categories: (result.Item.categories ?? []) as Category[],
      updatedAt: (result.Item.updatedAt ?? '') as string,
    }
  },

  async put(userId: string, categories: Category[]): Promise<ExpenseMetadata> {
    const metadata: ExpenseMetadata = {
      categories,
      updatedAt: new Date().toISOString(),
    }

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${userId}`,
        SK: 'META',
        ...metadata,
      },
    }))

    return metadata
  },
}
