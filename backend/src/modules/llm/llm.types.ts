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

export type LLMProviderName = 'mimo' | 'gemini'
