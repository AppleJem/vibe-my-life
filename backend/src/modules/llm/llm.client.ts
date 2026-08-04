import type {
  LLMProvider,
  LLMProviderName,
  LLMCompletionOptions,
  LLMCompletionResponse,
} from './llm.types.js'
import { createMimoProvider } from './providers/mimo.provider.js'
import { createGeminiProvider } from './providers/gemini.provider.js'

class LLMClient {
  private providers: Map<LLMProviderName, LLMProvider> = new Map()
  private defaultProvider: LLMProviderName = 'gemini'

  constructor() {
    // Initialize providers based on available API keys
    const mimoKey = process.env.MIMO_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY

    if (mimoKey && mimoKey !== 'your-mimo-api-key-here') {
      this.providers.set('mimo', createMimoProvider(mimoKey))
    }

    if (geminiKey && geminiKey !== 'your-gemini-api-key-here') {
      this.providers.set('gemini', createGeminiProvider(geminiKey))
    }

    // Set default to whichever is available, preferring gemini
    if (this.providers.has('gemini')) {
      this.defaultProvider = 'gemini'
    } else if (this.providers.has('mimo')) {
      this.defaultProvider = 'mimo'
    }
  }

  /** Check if a specific provider is available */
  hasProvider(name: LLMProviderName): boolean {
    return this.providers.has(name)
  }

  /** Get list of available provider names */
  getAvailableProviders(): LLMProviderName[] {
    return Array.from(this.providers.keys())
  }

  /** Get the current default provider name */
  getDefaultProvider(): LLMProviderName {
    return this.defaultProvider
  }

  /** Set the default provider */
  setDefaultProvider(name: LLMProviderName): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' is not available`)
    }
    this.defaultProvider = name
  }

  /** Get a specific provider instance */
  getProvider(name: LLMProviderName): LLMProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(
        `Provider '${name}' is not available. Available: ${this.getAvailableProviders().join(', ')}`
      )
    }
    return provider
  }

  /** Get the default provider instance */
  getDefault(): LLMProvider {
    return this.getProvider(this.defaultProvider)
  }

  /**
   * Complete using a specific provider, with fallback to default.
   * Useful for trying a specific model first, then falling back.
   */
  async complete(
    options: LLMCompletionOptions & { provider?: LLMProviderName }
  ): Promise<LLMCompletionResponse> {
    const providerName = options.provider || this.defaultProvider
    const provider = this.getProvider(providerName)
    return provider.complete(options)
  }
}

// Singleton instance
export const llmClient = new LLMClient()
