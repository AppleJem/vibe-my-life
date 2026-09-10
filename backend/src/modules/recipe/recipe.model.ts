import {
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { docClient, COOKING_TABLE_NAME } from '../../config/db.js'
import type { Recipe, RecipeInput, Quantity } from './recipe.types.d.js'

/** Fallback when the parser didn't suggest one. */
const DEFAULT_EMOJI = '🍽️'

const recipeKey = (userId: string, recipeId: string) => ({
  PK: `USER#${userId}`,
  SK: `RECIPE#${recipeId}`,
})

/** Pages a `begins_with` query to exhaustion. */
async function queryByPrefix<T>(userId: string, prefix: string): Promise<T[]> {
  const items: T[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: COOKING_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': prefix },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: true,
    }))

    items.push(...((result.Items ?? []) as T[]))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

/**
 * Drops an amount that isn't a usable number, so a parser hiccup can't store a `NaN` the
 * whole scaling chain would then spread across the page. A quantity that fails this reads
 * as "no measured amount" — "to taste" — which is the honest rendering of a number nobody
 * could make out.
 */
const cleanQuantity = (quantity: Quantity | undefined): Quantity | undefined => {
  if (!quantity || !Number.isFinite(quantity.amount)) return undefined
  return {
    amount: quantity.amount,
    ...(quantity.unit !== undefined && { unit: quantity.unit }),
  }
}

/**
 * Normalises the whole nested shape on the way in: ids assigned where they're missing,
 * absent optionals left off the item entirely rather than stored as `undefined` — which
 * DynamoDB rejects outright, and which is what distinguishes a timed step from a
 * check-off one.
 */
function toStored(input: RecipeInput): Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: input.title,
    emoji: input.emoji?.trim() || DEFAULT_EMOJI,
    ...(input.description !== undefined && { description: input.description }),
    servings: input.servings,
    ingredients: input.ingredients.map((ingredient) => {
      const quantity = cleanQuantity(ingredient.quantity)
      return {
        id: ingredient.id ?? uuidv4(),
        name: ingredient.name,
        ...(quantity && { quantity }),
        ...(ingredient.note !== undefined && { note: ingredient.note }),
      }
    }),
    steps: input.steps.map((step) => {
      // A step's markers index into this array, so holes can't be squeezed out — an
      // unusable amount becomes a zero-amount entry rather than shifting every marker
      // after it onto the wrong quantity.
      const quantities = step.quantities?.map(
        (quantity) => cleanQuantity(quantity) ?? { amount: 0 }
      )

      return {
        id: step.id ?? uuidv4(),
        title: step.title,
        ...(step.description !== undefined && { description: step.description }),
        ...(step.durationSeconds !== undefined && { durationSeconds: step.durationSeconds }),
        ...(quantities && quantities.length > 0 && { quantities }),
      }
    }),
  }
}

export const recipeModel = {
  /** Every recipe, whole. They are small, and the list shows more than a title. */
  async listRecipes(userId: string): Promise<Recipe[]> {
    return queryByPrefix<Recipe>(userId, 'RECIPE#')
  },

  async getRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
    const result = await docClient.send(new GetCommand({
      TableName: COOKING_TABLE_NAME,
      Key: recipeKey(userId, recipeId),
    }))

    return (result.Item as Recipe) ?? null
  },

  async createRecipe(userId: string, input: RecipeInput): Promise<Recipe> {
    const now = new Date().toISOString()
    const recipe: Recipe = {
      id: uuidv4(),
      ...toStored(input),
      createdAt: now,
      updatedAt: now,
    }

    await docClient.send(new PutCommand({
      TableName: COOKING_TABLE_NAME,
      Item: { ...recipeKey(userId, recipe.id), ...recipe },
    }))

    return recipe
  },

  /**
   * Replaces the recipe wholesale, keeping its id and `createdAt`. One `Put` rather than a
   * field-by-field `Update`: ingredients and steps are lists whose order *is* their
   * meaning, so every save that touches either is already sending the whole thing.
   *
   * Returns null when the recipe is gone, so editing something deleted on another device
   * 404s instead of resurrecting it.
   */
  async updateRecipe(
    userId: string,
    recipeId: string,
    input: RecipeInput
  ): Promise<Recipe | null> {
    const existing = await this.getRecipe(userId, recipeId)
    if (!existing) return null

    const recipe: Recipe = {
      id: existing.id,
      ...toStored(input),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    try {
      await docClient.send(new PutCommand({
        TableName: COOKING_TABLE_NAME,
        Item: { ...recipeKey(userId, recipeId), ...recipe },
        // The read above is not a lock; this is what makes the write a true update even if
        // the recipe was deleted in between.
        ConditionExpression: 'attribute_exists(SK)',
      }))
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return null
      throw err
    }

    return recipe
  },

  /** One item, so nothing cascades. */
  async deleteRecipe(userId: string, recipeId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: COOKING_TABLE_NAME,
      Key: recipeKey(userId, recipeId),
    }))
  },
}
