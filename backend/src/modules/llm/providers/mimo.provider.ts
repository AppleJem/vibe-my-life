import type {
  LLMProvider,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from '../llm.types.js'

const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const DEFAULT_MODEL = 'mimo-v2.5'

export function createMimoProvider(apiKey: string): LLMProvider {
  return {
    name: 'mimo',

    async complete(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
      const { messages, maxTokens = 4096, temperature, signal } = options
      const model = options.model || DEFAULT_MODEL

      // Convert our generic messages to Mimo's format
      const mimoMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      const body: Record<string, unknown> = {
        model,
        messages: mimoMessages,
        max_tokens: maxTokens,
      }
      if (temperature !== undefined) {
        body.temperature = temperature
      }

      const response = await fetch(MIMO_BASE_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Mimo API error:', errorText)
        throw new Error(`Mimo API error: ${response.status}`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]

      if (!choice?.message?.content) {
        throw new Error('No content in Mimo API response')
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
