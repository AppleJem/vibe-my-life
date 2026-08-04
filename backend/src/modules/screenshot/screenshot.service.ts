interface ParsedExpenseItem {
  date: string
  amount: number
  type: 'expense' | 'income'
  category: string
  note: string
}

const VALID_CATEGORIES = [
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

const VALID_INCOME_CATEGORIES = [
  '💰 Salary',
  '🎉 Bonus',
  '📈 Investment',
  '💼 Freelance',
  '🎁 Gift',
  '🔄 Refund',
  '🏠 Rental',
  '📦 Other',
]

function buildPrompt(categories: string[], incomeCategories: string[]): string {
  return `You are an expense parser. Extract all expense and income items from the provided screenshot(s).

Return a JSON array of items. Each item should have:
- "date": string in YYYY-MM-DD format (use today's date if not visible: ${new Date().toISOString().split('T')[0]})
- "amount": positive number (the monetary value)
- "type": "expense" or "income"
- "category": one of the valid categories listed below
- "note": brief description of what the expense/income was for

Valid expense categories: ${categories.join(', ')}

Valid income categories: ${incomeCategories.join(', ')}

Rules:
1. Only extract items that are clearly expenses or income
2. If a date is not visible, use today's date
3. If the category is unclear, use the most likely one
4. Keep notes concise but descriptive
5. Return ONLY the JSON array, no other text

Example response:
[
  {"date": "2026-08-04", "amount": 25.50, "type": "expense", "category": "🍜 Food", "note": "Lunch at restaurant"},
  {"date": "2026-08-04", "amount": 5000, "type": "income", "category": "💰 Salary", "note": "Monthly salary"}
]`
}

function validateAndCleanParsedItems(items: any[]): ParsedExpenseItem[] {
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
    .map((item) => ({
      date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        ? item.date
        : today,
      amount: Math.round(item.amount * 100) / 100, // Round to 2 decimal places
      type: item.type as 'expense' | 'income',
      category: VALID_CATEGORIES.includes(item.category) || VALID_INCOME_CATEGORIES.includes(item.category)
        ? item.category
        : '📦 Other',
      note: typeof item.note === 'string' ? item.note.slice(0, 200) : '',
    }))
}

export const screenshotService = {
  async parseScreenshots(images: Buffer[]): Promise<ParsedExpenseItem[]> {
    const apiKey = process.env.MIMO_API_KEY
    if (!apiKey || apiKey === 'your-mimo-api-key-here') {
      throw new Error('MIMO_API_KEY is not configured')
    }

    // Build messages with all images
    const content: any[] = []
    
    for (const imageBuffer of images) {
      const base64 = imageBuffer.toString('base64')
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
        },
      })
    }

    content.push({
      type: 'text',
      text: buildPrompt(VALID_CATEGORIES, VALID_INCOME_CATEGORIES),
    })

    const response = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts expense information from images. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: content,
          },
        ],
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Mimo API error:', errorText)
      throw new Error(`Mimo API error: ${response.status}`)
    }

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message?.content

    if (!assistantMessage) {
      throw new Error('No response from Mimo API')
    }

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

    return validateAndCleanParsedItems(parsedItems)
  },
}
