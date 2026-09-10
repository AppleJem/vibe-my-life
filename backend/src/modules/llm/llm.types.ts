export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | LLMContentPart[]
}

export interface LLMContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string // Can be a regular URL or data:image/jpeg;base64,...
  }
}

export interface LLMCompletionOptions {
  model?: string
  messages: LLMMessage[]
  maxTokens?: number
  temperature?: number
  /** AbortSignal for cancellation support */
  signal?: AbortSignal
  /**
   * Ask the provider to constrain the response to valid JSON. Advisory: a provider that
   * can't do it ignores the flag, so callers must still parse defensively.
   */
  jsonMode?: boolean
  /**
   * How much a hybrid reasoning model should think before answering. `'none'` disables
   * reasoning outright, which is what an extraction task wants — there is nothing to reason
   * about in "put this page into a fixed shape", and the thinking is billed and waited on as
   * completion tokens. Only honoured by providers whose models accept it (Groq's qwen3).
   */
  reasoningEffort?: 'none' | 'default' | 'low' | 'medium' | 'high'
}

export interface LLMCompletionResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMProvider {
  name: string
  complete(options: LLMCompletionOptions): Promise<LLMCompletionResponse>
}

export type LLMProviderName = 'mimo' | 'gemini' | 'groq'
