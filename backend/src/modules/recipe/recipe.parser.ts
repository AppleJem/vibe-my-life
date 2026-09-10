import { llmClient, type LLMProviderName, type LLMMessage } from '../llm/index.js'
import {
  normaliseUnit,
  unitSpellings,
  CANONICAL_UNITS,
  TIME_UNITS,
} from './recipe.units.js'
import type { Quantity, RecipeDraft } from './recipe.types.d.js'

/**
 * Turns a recipe — typed, pasted, or photographed — into the two structures the app
 * actually renders: an ingredient list with quantities, and ordered steps.
 *
 * An image is not OCR'd into text and then parsed again. The model reads the photo and
 * emits the structure in one pass, which is also what lets it use the layout: a column of
 * amounts down the left of a page is an ingredient list, and the numbered block below it
 * is the method.
 */

/**
 * The model this runs on, and why.
 *
 * Qwen 3.8 27B is multimodal, so one model reads a pasted recipe and a photograph of one — no
 * separate vision path, and no OCR-then-parse round trip that would throw the page layout
 * away. On Groq it is fast enough that a parse is a few seconds.
 *
 * Reasoning is disabled at the call site. Qwen 3 thinks by default, and a hybrid reasoning
 * model turned loose on "put this page into a fixed shape" spends thousands of completion
 * tokens deliberating over a task with nothing to deliberate about — which is exactly how a
 * parse ends up taking a minute and a half and still truncating at the ceiling.
 */
const PARSE_PROVIDER: LLMProviderName = 'groq'
const PARSE_MODEL = 'qwen/qwen3.8-27b'

/**
 * Qwen 3.8 accepts at most three images per request, and each costs 2,048 input tokens. The
 * route enforces the same number, so this is a backstop rather than the rule.
 */
const MAX_IMAGES = 3

/**
 * Enough for a long method section, and well under the model's 16k ceiling. With reasoning
 * off the whole budget goes to JSON, so a recipe that doesn't fit here wouldn't have fitted
 * in twice as much either.
 */
const MAX_OUTPUT_TOKENS = 8192

/** The cap the LLM is asked to respect, and the cap the response is trimmed to. */
const MAX_INGREDIENTS = 60
const MAX_STEPS = 40

/** A step longer than this is a misread clock, not a braise. */
const MAX_STEP_SECONDS = 86_400

function buildPrompt(): string {
  return `You are a recipe parser. Turn the recipe in the provided image(s) and/or text into structured JSON.

Return ONLY a JSON object, no other text, with these fields:
- "title": string — the dish name
- "emoji": string — a single emoji that suits the dish
- "description": string — one short sentence, or "" if there is nothing to say
- "servings": integer — how many servings the quantities as written are for. If the recipe does not say, infer the most likely number from the amounts (most home recipes are 2 or 4). Never return 0.
- "ingredients": array of { "name", "amount", "unit", "note" }
- "steps": array of { "title", "description", "durationSeconds", "quantities" }

Ingredient rules:
- "name" is the ingredient alone, e.g. "all-purpose flour". Do not put amounts in it.
- "amount" is a number (decimals, not fractions: write 0.5 not "1/2"). A mixed number is the SUM of its whole part and its fraction: "1 1/4" is 1.25, "1 1/2" is 1.5, "2 2/3" is 2.667 — never drop the whole number and return just the fraction. Omit "amount" entirely for things with no measurable amount ("salt to taste").
- "unit" is the unit of measure, omitted when the ingredient is simply counted ("3 eggs"). Use one of these tokens where it applies: ${CANONICAL_UNITS.join(', ')}.
- "note" is preparation or state — "finely diced", "room temperature", "divided". Use "" when there is none.

Step rules:
- "title" is a short imperative label, 2-6 words: "Sear the beef", "Rest the dough".
- "description" is the detail, or "" when the title says it all.
- "durationSeconds" is the step's hands-off time in seconds, ONLY when the recipe gives a time for performing the step, if no time is given in the recipe, omit this field. When a range is given, use the lower bound.
- "quantities" carries every amount that appears in this step's own text. IMPORTANT: do not write numbers with units inside "title" or "description". Put each one in "quantities" as { "amount", "unit" } and leave a marker {0}, {1}, ... in the text where it belongs, indexed by its position in the array.
  Example: "description": "Whisk in {0} of milk and {1} of flour", "quantities": [ { "amount": 250, "unit": "ml" }, { "amount": 2, "unit": "tbsp" } ]
  Oven and pan temperatures count: use unit "f" or "c".
- NEVER put a duration in "quantities". Times are not amounts: they do not change when the recipe is scaled, and a marker would make them change. Write the time as ordinary words and put the machine-readable version in "durationSeconds".
  WRONG: "description": "Simmer for {0} and rest {1}", "quantities": [ { "amount": 3, "unit": "minute" }, { "amount": 10, "unit": "minute" } ]
  RIGHT: "description": "Simmer for 3 minutes and rest 10 minutes", "durationSeconds": 180
- Plain numbers that are not measurements ("cut into 6 wedges" when the count is part of the instruction) may stay in the text.

Keep the recipe's own order. At most ${MAX_INGREDIENTS} ingredients and ${MAX_STEPS} steps.

Example response:
{"title":"Garlic Butter Pasta","emoji":"🍝","description":"A fast weeknight pasta.","servings":2,"ingredients":[{"name":"spaghetti","amount":200,"unit":"g","note":""},{"name":"garlic","amount":3,"unit":"clove","note":"thinly sliced"},{"name":"salt","note":"to taste"}],"steps":[{"title":"Boil the pasta","description":"Salt the water heavily and cook until al dente.","durationSeconds":540},{"title":"Fry the garlic","description":"Melt {0} of butter over low heat and add the garlic.","quantities":[{"amount":2,"unit":"tbsp"}]}]}`
}

/** Strips the markdown fence an LLM adds even when told not to. */
function stripFence(raw: string): string {
  let text = raw.trim()
  if (text.startsWith('```json')) text = text.slice(7)
  else if (text.startsWith('```')) text = text.slice(3)
  if (text.endsWith('```')) text = text.slice(0, -3)
  return text.trim()
}

const asText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

/** A positive, finite number, or undefined — which is what "no amount given" looks like. */
function asAmount(value: unknown): number | undefined {
  const amount = typeof value === 'string' ? Number(value) : value
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return undefined
  // Zero is not an amount, and a negative one is a misread minus sign.
  return amount > 0 ? Math.round(amount * 1000) / 1000 : undefined
}

function asQuantity(raw: unknown): Quantity | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const amount = asAmount((raw as { amount?: unknown }).amount)
  if (amount === undefined) return undefined

  const unit = normaliseUnit(asText((raw as { unit?: unknown }).unit, 24) || undefined)
  return { amount, ...(unit && { unit }) }
}

/**
 * Clamps a step's quantity list to the markers its text actually uses, and keeps the
 * positions: the markers are indexes, so a dropped entry would silently re-point every
 * marker after it. An unusable amount becomes a zero-amount placeholder instead, which
 * renders as the marker's own literal text.
 */
function parseStepQuantities(raw: unknown): Quantity[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined

  const quantities = raw
    .slice(0, 12)
    .map((entry) => asQuantity(entry) ?? { amount: 0 })

  // An all-placeholder list is the same as no list at all.
  return quantities.some((quantity) => quantity.amount > 0) ? quantities : undefined
}

/**
 * Puts any duration the model smuggled into `quantities` back into the prose it came from.
 *
 * A quantity is a thing that scales: double the servings and every marker on the page doubles
 * with it. A time must not — "simmer for 3 minutes" is 3 minutes however many you are cooking
 * for — so a marker pointing at one is a bug that only shows itself once someone touches the
 * stepper. The prompt asks for times as words and the model mostly complies; this is what
 * makes it true rather than likely.
 *
 * The marker is replaced with the words it stood for and its slot is blanked rather than
 * removed, because the remaining markers are indexes into this array and closing the gap
 * would re-point every one of them.
 */
function inlineTimeQuantities(
  step: { title: string; description?: string; quantities?: Quantity[] }
): typeof step {
  if (!step.quantities?.some((quantity) => quantity.unit && TIME_UNITS.has(quantity.unit))) {
    return step
  }

  const quantities = [...step.quantities]

  const inline = (text: string): string =>
    text.replace(/\{(\d+)\}/g, (marker, digits: string) => {
      const quantity = quantities[Number(digits)]
      if (!quantity?.unit || !TIME_UNITS.has(quantity.unit)) return marker

      const plural = quantity.amount === 1 ? quantity.unit : `${quantity.unit}s`
      return `${quantity.amount} ${plural}`
    })

  const title = inline(step.title)
  const description = step.description === undefined ? undefined : inline(step.description)

  for (const [index, quantity] of quantities.entries()) {
    if (quantity.unit && TIME_UNITS.has(quantity.unit)) quantities[index] = { amount: 0 }
  }

  return {
    ...step,
    title,
    ...(description !== undefined && { description }),
    // An array of nothing but blanked slots has no markers left pointing at it.
    ...(quantities.some((quantity) => quantity.amount > 0)
      ? { quantities }
      : { quantities: undefined }),
  }
}

/**
 * Drops a unit the model wrote twice: once inside the marker's quantity, and again as a word
 * immediately after it. "Keep warm in a {0} F oven" with `{ amount: 200, unit: 'f' }` renders
 * as "200 °F F oven" — the marker already carries the unit, so the loose word is a duplicate.
 *
 * Only a spelling of that marker's own unit is removed. "{0} of milk" keeps its "of", and
 * "{0} cup of batter" loses only the "cup" that the marker was already going to print.
 */
function stripDuplicateUnits(text: string, quantities: Quantity[]): string {
  return text.replace(
    /\{(\d+)\}\s*(°?[A-Za-z]+\.?)/g,
    (match, digits: string, word: string) => {
      const unit = quantities[Number(digits)]?.unit
      if (!unit) return match

      const candidate = word.toLowerCase().replace(/\.$/, '')
      const spellings = unitSpellings(unit).map((spelling) => spelling.toLowerCase())

      return spellings.includes(candidate) || candidate === `°${unit}`
        ? `{${digits}}`
        : match
    }
  )
}

function asDuration(value: unknown): number | undefined {
  const seconds = typeof value === 'string' ? Number(value) : value
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return undefined
  return Math.min(Math.round(seconds), MAX_STEP_SECONDS)
}

/**
 * Everything past this point treats the LLM's output as hostile: the shape is checked
 * field by field, and anything unusable is dropped rather than stored. The draft goes to a
 * review screen before it is ever saved, so the bar is "nothing here can break the
 * renderer", not "this is definitely right".
 */
function toDraft(raw: unknown): RecipeDraft {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Recipe response was not an object')
  }

  const source = raw as Record<string, unknown>

  const ingredients = (Array.isArray(source.ingredients) ? source.ingredients : [])
    .slice(0, MAX_INGREDIENTS)
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []

      const row = entry as Record<string, unknown>
      const name = asText(row.name, 120)
      if (!name) return []

      // The amount and unit arrive flat on an ingredient but nest on a step, because the
      // prompt is easier for the model to follow that way. Both end up as a `Quantity`.
      const quantity = asQuantity({ amount: row.amount, unit: row.unit })
      const note = asText(row.note, 160)

      return [{ name, ...(quantity && { quantity }), ...(note && { note }) }]
    })

  const steps = (Array.isArray(source.steps) ? source.steps : [])
    .slice(0, MAX_STEPS)
    .flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []

      const row = entry as Record<string, unknown>
      const description = asText(row.description, 2000)
      // A step with no title but a description is still a step — the description leads,
      // which is better than dropping an instruction for want of a label.
      const title = asText(row.title, 160) || description.slice(0, 60)
      if (!title) return []

      const durationSeconds = asDuration(row.durationSeconds)
      const quantities = parseStepQuantities(row.quantities)

      const step = inlineTimeQuantities({
        title,
        ...(description && description !== title && { description }),
        ...(quantities && { quantities }),
      })

      const cleaned = step.quantities
        ? {
          ...step,
          title: stripDuplicateUnits(step.title, step.quantities),
          ...(step.description !== undefined && {
            description: stripDuplicateUnits(step.description, step.quantities),
          }),
        }
        : step

      return [{
        ...cleaned,
        ...(durationSeconds !== undefined && { durationSeconds }),
      }]
    })

  if (ingredients.length === 0 && steps.length === 0) {
    throw new Error('No ingredients or steps could be read')
  }

  const servings = asAmount(source.servings)

  return {
    title: asText(source.title, 160) || 'Untitled recipe',
    emoji: asText(source.emoji, 8) || '🍽️',
    description: asText(source.description, 400) || undefined,
    // Servings is a stepper value, so it has to be a whole number; two is the commonest
    // yield and the least wrong guess when the recipe never said.
    servings: servings ? Math.max(1, Math.min(99, Math.round(servings))) : 2,
    ingredients,
    steps,
  }
}

export const recipeParser = {
  /**
   * `text` and `images` are both optional, and either alone is enough — a photo of a page,
   * a pasted block of text, or a photo plus the note that came with it.
   */
  async parse(
    { text, images }: { text?: string; images?: Buffer[] },
    provider?: LLMProviderName
  ): Promise<RecipeDraft> {
    const content: LLMMessage['content'] = []

    // An explicit provider wins — that is what the parameter is for. Otherwise Groq, unless it
    // isn't configured, in which case the client's own default keeps this working rather than
    // failing on a missing key.
    const useProvider =
      provider ?? (llmClient.hasProvider(PARSE_PROVIDER) ? PARSE_PROVIDER : undefined)
    const onGroq = useProvider === PARSE_PROVIDER

    for (const image of (images ?? []).slice(0, MAX_IMAGES)) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
      })
    }

    if (text?.trim()) {
      content.push({ type: 'text', text: `Recipe:\n\n${text.trim()}` })
    }

    content.push({ type: 'text', text: buildPrompt() })
    const startTime = Date.now();

    const response = await llmClient.complete({
      messages: [
        {
          role: 'system',
          content:
            'You extract structured recipes from images and text. Always respond with valid JSON only.',
        },
        { role: 'user', content },
      ],
      maxTokens: MAX_OUTPUT_TOKENS,
      provider: useProvider,
      // Both are only meaningful on Groq today; every other provider ignores them. Tying them
      // to the model that documents them keeps the reason legible.
      ...(onGroq && { model: PARSE_MODEL, jsonMode: true, reasoningEffort: 'none' as const }),
    })
    console.log(`Response token usage: ${JSON.stringify(response.usage, null, 2)}`)
    const endTime = Date.now();
    console.log(`Recipe parsed by ${useProvider || 'default'}, Time taken: ${endTime - startTime}ms. Model:`, response.model)

    let parsed: unknown
    try {
      parsed = JSON.parse(stripFence(response.content))
    } catch {
      console.error('Failed to parse recipe response as JSON:', response.content.slice(0, 500))
      throw new Error('Invalid JSON response from LLM')
    }

    return toDraft(parsed)
  },
}
