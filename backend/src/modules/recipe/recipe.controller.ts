import type { Request, Response } from 'express'
import { z } from 'zod'
import { recipeModel } from './recipe.model.js'
import { recipeParser } from './recipe.parser.js'
import { normaliseUnit } from './recipe.units.js'
import type { LLMProviderName } from '../llm/index.js'

/**
 * An amount is always positive — "0 cups" is not a measurement — and bounded well above
 * anything a household recipe asks for, so a misparsed page can't store a number that
 * makes the scaled view unreadable.
 */
const quantitySchema = z.object({
  amount: z.number().positive().max(1_000_000),
  unit: z.string().min(1).max(24).optional(),
})

const ingredientSchema = z.object({
  // Present on an edit, absent on a row the form just added.
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Name is required').max(120),
  quantity: quantitySchema.optional(),
  note: z.string().max(160).optional(),
})

/** Mirrors the habit action item: a timer makes the step timed, its absence makes it manual. */
const stepSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required').max(160),
  description: z.string().max(2000).optional(),
  durationSeconds: z.number().int().positive().max(86_400).optional(),
  /** Indexed by the `{0}`, `{1}` … markers in the text above. */
  quantities: z.array(quantitySchema).max(12).optional(),
})

const recipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(160),
  emoji: z.string().min(1).max(8).optional(),
  description: z.string().max(400).optional(),
  // The figure every displayed quantity is scaled against, so it can't be zero.
  servings: z.number().int().positive().max(99),
  ingredients: z.array(ingredientSchema).max(60),
  steps: z.array(stepSchema).max(40),
})

/** A recipe with neither an ingredient nor a step is an empty page, not a recipe. */
const recipeBodySchema = recipeSchema.refine(
  (recipe) => recipe.ingredients.length > 0 || recipe.steps.length > 0,
  { message: 'A recipe needs at least one ingredient or step' }
)

type RecipeBody = z.infer<typeof recipeSchema>

/**
 * Canonicalises every unit a client sends, so a recipe typed by hand converts exactly like
 * one that came through the parser. Doing it here rather than trusting the form is the
 * same reasoning the habit controller applies to `unit` and `target`: the client must not
 * be the only thing keeping stored data coherent.
 */
function normaliseUnits(recipe: RecipeBody): RecipeBody {
  const fix = <T extends { unit?: string }>(quantity: T): T => {
    const unit = normaliseUnit(quantity.unit)
    return unit === undefined ? ({ ...quantity, unit: undefined } as T) : { ...quantity, unit }
  }

  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      ...(ingredient.quantity && { quantity: fix(ingredient.quantity) }),
    })),
    steps: recipe.steps.map((step) => ({
      ...step,
      ...(step.quantities && { quantities: step.quantities.map(fix) }),
    })),
  }
}

export const recipeController = {
  async listRecipes(req: Request, res: Response) {
    try {
      const recipes = await recipeModel.listRecipes(req.userId!)
      return res.json({ recipes })
    } catch (err) {
      console.error('Error fetching recipes:', err)
      return res.status(500).json({ error: 'Failed to fetch recipes' })
    }
  },

  async getRecipe(req: Request, res: Response) {
    try {
      const recipe = await recipeModel.getRecipe(req.userId!, req.params.id as string)
      if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
      return res.json({ recipe })
    } catch (err) {
      console.error('Error fetching recipe:', err)
      return res.status(500).json({ error: 'Failed to fetch recipe' })
    }
  },

  async createRecipe(req: Request, res: Response) {
    const parsed = recipeBodySchema.safeParse(req.body)

    if (!parsed.success) {
      console.warn('Rejected recipe create:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const recipe = await recipeModel.createRecipe(req.userId!, normaliseUnits(parsed.data))
      return res.status(201).json({ recipe })
    } catch (err) {
      console.error('Error creating recipe:', err)
      return res.status(500).json({ error: 'Failed to create recipe' })
    }
  },

  /** A save replaces the recipe — see `recipeModel.updateRecipe`. */
  async updateRecipe(req: Request, res: Response) {
    const parsed = recipeBodySchema.safeParse(req.body)

    if (!parsed.success) {
      console.warn('Rejected recipe update:', parsed.error.flatten())
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    try {
      const recipe = await recipeModel.updateRecipe(
        req.userId!,
        req.params.id as string,
        normaliseUnits(parsed.data)
      )
      if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
      return res.json({ recipe })
    } catch (err) {
      console.error('Error updating recipe:', err)
      return res.status(500).json({ error: 'Failed to update recipe' })
    }
  },

  async deleteRecipe(req: Request, res: Response) {
    try {
      await recipeModel.deleteRecipe(req.userId!, req.params.id as string)
      return res.status(204).send()
    } catch (err) {
      console.error('Error deleting recipe:', err)
      return res.status(500).json({ error: 'Failed to delete recipe' })
    }
  },

  /**
   * Parses a recipe without storing anything — photos, pasted text, or both. The draft goes
   * back to a review screen, and saving it is a separate `POST /api/recipes`, so a parse
   * that read the page badly costs a glance rather than a recipe to clean up.
   */
  async parseRecipe(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[] | undefined
    const text = typeof req.body.text === 'string' ? req.body.text : undefined
    const provider = req.body.provider as LLMProviderName | undefined

    if ((!files || files.length === 0) && !text?.trim()) {
      return res.status(400).json({ error: 'Provide recipe text or at least one image' })
    }

    // The model's own context is the real limit; this just keeps an accidental paste of a
    // whole cookbook from reaching it.
    if (text && text.length > 20_000) {
      return res.status(400).json({ error: 'Recipe text is too long' })
    }

    try {
      const draft = await recipeParser.parse({
        text,
        images: files?.map((file) => file.buffer),
      }, provider)

      return res.json({ draft })
    } catch (err: any) {
      console.error('Error parsing recipe:', err)
      return res.status(502).json({ error: err.message || 'Failed to parse the recipe' })
    }
  },
}
