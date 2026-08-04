import type {
  LLMProvider,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from '../llm.types.js'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

export function createGeminiProvider(apiKey: string): LLMProvider {
  return {
    name: 'gemini',

    async complete(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
      const { messages, maxTokens = 4096, temperature, signal } = options
      const model = options.model || DEFAULT_MODEL

      // Convert our generic messages to Gemini's OpenAI-compatible format
      const geminiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const body: Record<string, unknown> = {
        model,
        messages: geminiMessages,
        max_tokens: maxTokens,
      }
      if (temperature !== undefined) {
        body.temperature = temperature
      }

      const response = await fetch(GEMINI_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error:', errorText)
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]

      if (!choice?.message?.content) {
        throw new Error('No content in Gemini API response')
      }

      return {
        content: choice.message.content,
        model: data.model || model,
        usage: data.usage
          ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
          : undefined,
      }
    },
  }
}
