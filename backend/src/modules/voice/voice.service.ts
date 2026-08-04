import Groq, { toFile } from 'groq-sdk'
import { llmClient, type LLMProviderName, type LLMMessage } from '../llm/index.js'
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
  incomeCategories: VoiceCategory[]
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

  return `You are an expense parser. Extract all expense and income items from the following voice transcript.

Return a JSON array of items. Each item should have:
- "date": string in YYYY-MM-DD format (use today's date if not mentioned: ${new Date().toISOString().split('T')[0]})
- "amount": positive number (the monetary value)
- "type": "expense" or "income"
- "category": MUST be one of the exact category names listed below
- "note": brief description of what the expense/income was for

Valid expense categories:
${formatCategories(categories).join(', ')}

Valid income categories:
${formatCategories(incomeCategories).join(', ')}

Example response (using actual categories from the lists above):
[
  {"date": "2026-08-04", "amount": 25.50, "type": "expense", "category": "${categoryNames[0] || '🍜 Food'}", "note": "Lunch at restaurant"},
  {"date": "2026-08-04", "amount": 5000, "type": "income", "category": "${incomeCategoryNames[0] || '💰 Salary'}", "note": "Monthly salary"}
]`
}

/**
 * Validate and clean parsed items from LLM response
 */
function validateAndCleanParsedItems(
  items: any[],
  validCategories: string[],
  validIncomeCategories: string[]
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

      return {
        date:
          typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? item.date
            : today,
        amount: Math.round(item.amount * 100) / 100,
        type: item.type as 'expense' | 'income',
        category,
        note: typeof item.note === 'string' ? item.note.slice(0, 200) : '',
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
   * @param provider - Optional: specify which LLM provider to use
   */
  async parseVoiceRecording(
    audioBuffer: Buffer,
    mimeType: string,
    categories: VoiceCategory[],
    incomeCategories: VoiceCategory[],
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
        content: `${buildPrompt(expenseCategories, incCategories)}\n\nTranscript:\n${transcript}`,
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
    const items = validateAndCleanParsedItems(parsedItems, validCategories, validIncomeCategories)

    return { transcript, items }
  },
}
