import Groq, { toFile } from 'groq-sdk'
import { llmClient, type LLMMessage } from '../llm/index.js'
import { env } from '../../config/env.js'

export interface VoiceCategory {
  name: string
  subcategories: string[]
}

interface ParsedExpenseItem {
  date: string
  amount: number
  type: 'expense' | 'income'
  category: string
  note: string
  /**
   * ISO 4217 code, present only when the speaker named a currency other than their
   * base. `amount` then holds the figure *as spoken*, in this currency — the LLM
   * never converts, because it has no rate. The client prices it into the base
   * currency after parsing, which is where the rate lookup lives.
   */
  currency?: string
}

// Default categories as fallback
const DEFAULT_CATEGORIES = [
  '🍜 Food',
  '🚗 Transport',
  '🏠 Household',
  '👕 Apparel',
  '⚽ Sports',
  '📚 Education',
  '🎁 Gift',
  '🛒 Shopping',
  '🏥 Medical',
  '💕 Dating',
  '✈️ Travel',
  '📦 Other',
]

// Mirrors the frontend's DEFAULT_BASE_CURRENCY; only reached when the client omits it.
const DEFAULT_BASE_CURRENCY = 'SGD'

const DEFAULT_INCOME_CATEGORIES = [
  '💰 Salary',
  '🎉 Bonus',
  '📈 Investment',
  '💼 Freelance',
  '🎁 Gift',
  '🔄 Refund',
  '🏠 Rental',
  '📦 Other',
]

// Lazily created so a missing API key surfaces as a clear runtime error, not an import crash
let groqClient: Groq | null = null
function getGroqClient(): Groq {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured')
    }
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY })
  }
  return groqClient
}

/**
 * Transcribe audio using Groq's Whisper model
 */
async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const groq = getGroqClient()

  console.log('Audio buffer size:', audioBuffer.length, 'bytes')
  console.log('MIME type:', mimeType)
  console.log('Magic bytes:', audioBuffer.subarray(0, 4).toString('hex'))

  // Dev-only escape hatch: dump the received audio so it can be inspected with ffprobe
  if (process.env.DEBUG_VOICE_DUMP) {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(process.env.DEBUG_VOICE_DUMP, audioBuffer)
    console.log('Dumped audio to', process.env.DEBUG_VOICE_DUMP)
  }

  // Determine filename from MIME type
  const mimeToFilename: Record<string, string> = {
    'audio/webm': 'recording.webm',
    'audio/ogg': 'recording.ogg',
    'audio/mp4': 'recording.mp4',
    'audio/mpeg': 'recording.mp3',
    'audio/wav': 'recording.wav',
    'audio/mp3': 'recording.mp3',
    'audio/m4a': 'recording.m4a',
  }

  const cleanMimeType = mimeType.split(';')[0].trim()
  const filename = mimeToFilename[cleanMimeType] || 'recording.webm'

  console.log('Sending to Groq as:', filename, 'with MIME:', cleanMimeType)

  try {
    const file = await toFile(audioBuffer, filename, { type: cleanMimeType })
    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
    })
    console.log('[voice] Groq transcription result:', result)
    return result.text
  } catch (error: any) {
    console.error('Groq transcription error:', error)
    throw new Error(`Groq ASR failed: ${error.message}`)
  }
}

/**
 * Build the LLM prompt for parsing transcript into expense items
 */
function buildPrompt(
  categories: VoiceCategory[],
  incomeCategories: VoiceCategory[],
  baseCurrency: string,
  knownCurrencies: string[]
): string {
  // Build category strings with subcategories if present
  const formatCategories = (cats: VoiceCategory[]) =>
    cats.map((c) =>
      c.subcategories.length > 0
        ? `${c.name} (sub: ${c.subcategories.join(', ')})`
        : c.name
    )

  const categoryNames = categories.map((c) => c.name)
  const incomeCategoryNames = incomeCategories.map((c) => c.name)

  const otherCurrencies = knownCurrencies.filter((c) => c !== baseCurrency)

  return `You are an expense parser. Extract all expense and income items from the following voice transcript.

Return a JSON array of items. Each item should have:
- "date": string in YYYY-MM-DD format (use today's date if not mentioned: ${new Date().toISOString().split('T')[0]})
- "amount": positive number (the monetary value, exactly as spoken — never convert it)
- "type": "expense" or "income"
- "category": MUST be one of the exact category names listed below
- "note": brief description of what the expense/income was for
- "currency": OPTIONAL ISO 4217 code, described below

Currency rules — the user's base currency is ${baseCurrency}:
- Omit "currency" entirely when the amount is in ${baseCurrency}. Most items have no currency.
- Set "currency" ONLY when the speaker explicitly names a different currency, e.g. "3000 yen" → "JPY", "20 US dollars" → "USD", "15 euros" → "EUR", "500 baht" → "THB".
- "amount" stays as spoken. For "3000 yen" the amount is 3000 and the currency is "JPY". Do NOT convert to ${baseCurrency} — you do not have exchange rates, and a converted number would be wrong.
- A bare "dollars", "bucks", or a plain number with no currency named means ${baseCurrency}. Only treat "dollars" as USD when the speaker says so explicitly ("US dollars", "American dollars").
- Any valid ISO 4217 code is allowed.${
    otherCurrencies.length > 0
      ? ` The user commonly spends in: ${otherCurrencies.join(', ')}.`
      : ''
  }

Valid expense categories:
${formatCategories(categories).join(', ')}

Valid income categories:
${formatCategories(incomeCategories).join(', ')}

Example response (using actual categories from the lists above):
[
  {"date": "2026-08-04", "amount": 25.50, "type": "expense", "category": "${categoryNames[0] || '🍜 Food'}", "note": "Lunch at restaurant"},
  {"date": "2026-08-04", "amount": 3000, "type": "expense", "category": "${categoryNames[0] || '🍜 Food'}", "note": "Ramen in Tokyo", "currency": "JPY"},
  {"date": "2026-08-04", "amount": 5000, "type": "income", "category": "${incomeCategoryNames[0] || '💰 Salary'}", "note": "Monthly salary"}
]`
}

/**
 * Accepts a currency only when it's a well-formed ISO 4217 code that differs from the
 * base — "SGD" on a SGD account is the same as saying nothing, and carrying it forward
 * would mark a domestic expense as foreign for the rest of its life.
 */
function normaliseCurrency(value: unknown, baseCurrency: string): string | undefined {
  if (typeof value !== 'string') return undefined

  const code = value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return undefined
  if (code === baseCurrency.toUpperCase()) return undefined

  return code
}

/**
 * Validate and clean parsed items from LLM response
 */
function validateAndCleanParsedItems(
  items: any[],
  validCategories: string[],
  validIncomeCategories: string[],
  baseCurrency: string
): ParsedExpenseItem[] {
  const today = new Date().toISOString().split('T')[0]

  return items
    .filter((item) => {
      return (
        item &&
        typeof item.amount === 'number' &&
        item.amount > 0 &&
        (item.type === 'expense' || item.type === 'income') &&
        typeof item.category === 'string' &&
        item.category.length > 0
      )
    })
    .map((item) => {
      // Try to match category exactly, then fuzzy match
      let category = item.category
      const validList = item.type === 'income' ? validIncomeCategories : validCategories

      if (!validList.includes(category)) {
        // Try fuzzy match: check if category name is contained in any valid category
        const fuzzyMatch = validList.find(
          (c) => c.includes(category) || category.includes(c.replace(/^[^\s]+\s/, ''))
        )
        category = fuzzyMatch || '📦 Other'
      }

      const currency = normaliseCurrency(item.currency, baseCurrency)

      return {
        date:
          typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? item.date
            : today,
        amount: Math.round(item.amount * 100) / 100,
        type: item.type as 'expense' | 'income',
        category,
        note: typeof item.note === 'string' ? item.note.slice(0, 200) : '',
        ...(currency && { currency }),
      }
    })
}

export const voiceService = {
  /**
   * Process voice recording into expense items
   * @param audioBuffer - The audio file buffer
   * @param mimeType - The audio MIME type
   * @param categories - User's expense categories
   * @param incomeCategories - User's income categories
   * @param baseCurrency - The user's base currency; anything else spoken is foreign
   * @param currencies - Codes the user has configured, used to steer ambiguous names
   */
  async parseVoiceRecording(
    audioBuffer: Buffer,
    mimeType: string,
    categories: VoiceCategory[],
    incomeCategories: VoiceCategory[],
    baseCurrency = DEFAULT_BASE_CURRENCY,
    currencies: string[] = [],
  ): Promise<{ transcript: string; items: ParsedExpenseItem[] }> {
    // Use provided categories or fall back to defaults
    const expenseCategories = categories.length > 0 ? categories :
      DEFAULT_CATEGORIES.map((name) => ({ name, subcategories: [] }))
    const incCategories = incomeCategories.length > 0 ? incomeCategories :
      DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, subcategories: [] }))

    // Step 1: Transcribe audio using Groq ASR
    console.log('[voice] ⏱️  ASR: starting transcription...')
    const asrStart = Date.now()
    const transcript = await transcribeAudio(audioBuffer, mimeType)
    const asrMs = Date.now() - asrStart
    console.log(`[voice] ✅ ASR: done in ${asrMs}ms`)
    console.log('[voice] Transcript:', transcript)

    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No speech detected in the audio recording')
    }

    // Step 2: Use LLM to parse transcript into expense items
    console.log('[voice] ⏱️  LLM: starting parse...')
    console.log('[voice] Using categories:', expenseCategories.length, 'expense,', incCategories.length, 'income')
    const llmStart = Date.now()
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that extracts expense information from voice transcripts. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: `${buildPrompt(expenseCategories, incCategories, baseCurrency, currencies)}\n\nTranscript:\n${transcript}`,
      },
    ]

    console.log('LLM prompt for parseVoiceRecording', messages)

    const response = await llmClient.complete({
      messages,
      maxTokens: 4096,
      provider: "gemini"
    })
    const llmMs = Date.now() - llmStart
    console.log(`[voice] ✅ LLM: done in ${llmMs}ms (model: ${response.model})`)

    const assistantMessage = response.content
    console.log(`[voice] 📊 Total pipeline: ${asrMs + llmMs}ms (ASR: ${asrMs}ms, LLM: ${llmMs}ms)`)

    // Parse JSON from the response (handle potential markdown code blocks)
    let jsonStr = assistantMessage.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7)
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3)
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3)
    }
    jsonStr = jsonStr.trim()

    let parsedItems: any[]
    try {
      parsedItems = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', jsonStr)
      throw new Error('Invalid JSON response from LLM')
    }

    if (!Array.isArray(parsedItems)) {
      throw new Error('LLM response is not an array')
    }

    // Get valid category names for validation
    const validCategories = expenseCategories.map((c) => c.name)
    const validIncomeCategories = incCategories.map((c) => c.name)
    const items = validateAndCleanParsedItems(
      parsedItems,
      validCategories,
      validIncomeCategories,
      baseCurrency
    )

    return { transcript, items }
  },
}
