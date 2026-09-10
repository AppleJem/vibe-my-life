import type {
  LLMProvider,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from '../llm.types.js'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Qwen 3.8 27B — multimodal, so one model reads both a pasted recipe and a photo of one.
 * Fast enough on Groq that a parse is a few seconds rather than a wait.
 */
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

/**
 * Groq, through its OpenAI-compatible endpoint — same shape as the Mimo and Gemini
 * providers, with two parameters neither of those has.
 *
 * `max_tokens` is deprecated here in favour of `max_completion_tokens`; the old name still
 * works but is the sort of thing that stops working quietly, so this sends the current one.
 *
 * `reasoning_effort: 'none'` is the one that matters. Qwen 3 is a hybrid reasoning model and
 * will think at length by default — those tokens are billed and streamed as completion
 * tokens, so a structured extraction that needs 1,500 tokens of JSON can spend 8,000 getting
 * there. For a task whose whole output is a fixed shape there is nothing to reason about, so
 * callers that know that can turn it off. Only qwen3 models accept `none`; the field is only
 * sent when a caller asks for it, so it can't break the others.
 */
export function createGroqProvider(apiKey: string): LLMProvider {
  return {
    name: 'groq',

    async complete(options: LLMCompletionOptions): Promise<LLMCompletionResponse> {
      const {
        messages,
        maxTokens = 4096,
        temperature,
        signal,
        jsonMode,
        reasoningEffort,
      } = options
      const model = options.model || DEFAULT_MODEL

      const body: Record<string, unknown> = {
        model,
        messages: messages.map((msg) => ({ role: msg.role, content: msg.content })),
        max_completion_tokens: maxTokens,
      }

      if (temperature !== undefined) body.temperature = temperature
      if (reasoningEffort !== undefined) body.reasoning_effort = reasoningEffort
      // Constrains the decoder to valid JSON, which removes the markdown fence and the
      // "Here's the recipe:" preamble as failure modes rather than parsing around them.
      if (jsonMode) body.response_format = { type: 'json_object' }

      const response = await fetch(GROQ_BASE_URL, {
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
        console.error('Groq API error:', errorText)
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      const choice = data.choices?.[0]

      if (!choice?.message?.content) {
        throw new Error('No content in Groq API response')
      }

      // A response cut off at the token ceiling is truncated JSON, which fails to parse a
      // step later with nothing to point at. Saying so here names the actual problem.
      if (choice.finish_reason === 'length') {
        console.warn(
          `Groq response hit the ${maxTokens}-token ceiling and was truncated (model ${model}).`
        )
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
