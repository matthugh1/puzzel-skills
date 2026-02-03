import { db } from '@shared/database';
import { chatWithOpenAI, chatWithAnthropic } from '@/lib/ai-client';
import { decryptApiKey } from '@/lib/encryption';
import type { ChatMessage, ChatResponse } from '@/lib/ai-client';

/**
 * LLM Service for Compliance Analyzer
 * Accesses LLM providers from the database and makes API calls
 */
class LLMService {
  /**
   * Get the enabled LLM provider with decrypted API key
   */
  private async getEnabledProvider() {
    const provider = await db.llmProvider.findFirst({
      where: { enabled: true },
    });

    if (!provider) {
      throw new Error('No LLM provider is currently configured and enabled');
    }

    try {
      const decryptedKey = decryptApiKey(provider.apiKey);
      return {
        provider: provider.provider as 'openai' | 'anthropic',
        apiKey: decryptedKey,
      };
    } catch (error) {
      console.error('Error decrypting API key:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Chat using the configured LLM provider
   * @param provider Optional provider override. If not provided, uses the enabled provider from database.
   */
  async chat(
    messages: ChatMessage[],
    options: { model?: string; temperature?: number; maxTokens?: number } = {},
    providerOverride?: 'openai' | 'anthropic'
  ): Promise<ChatResponse> {
    let provider: { provider: 'openai' | 'anthropic'; apiKey: string };
    
    if (providerOverride) {
      // Use the specified provider - check if it exists and is configured
      const selectedProvider = await db.llmProvider.findUnique({
        where: { provider: providerOverride },
      });
      
      if (!selectedProvider) {
        throw new Error(`Provider ${providerOverride} is not configured. Please configure it in the admin settings.`);
      }
      
      if (!selectedProvider.enabled) {
        throw new Error(`Provider ${providerOverride} is configured but not enabled. Please enable it in the admin settings.`);
      }
      
      try {
        const decryptedKey = decryptApiKey(selectedProvider.apiKey);
        provider = {
          provider: selectedProvider.provider as 'openai' | 'anthropic',
          apiKey: decryptedKey,
        };
      } catch (error) {
        console.error('Error decrypting API key:', error);
        throw new Error('Failed to decrypt API key');
      }
    } else {
      // Use the enabled provider (default behavior)
      provider = await this.getEnabledProvider();
    }

    if (provider.provider === 'openai') {
      return chatWithOpenAI(provider.apiKey, messages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
    } else if (provider.provider === 'anthropic') {
      return chatWithAnthropic(provider.apiKey, messages, {
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
    } else {
      throw new Error(`Unsupported provider: ${provider.provider}`);
    }
  }
}

export const llmService = new LLMService();
