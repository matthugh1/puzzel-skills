/**
 * LLM Client Utilities
 * Client-safe utility functions that can be imported in browser code
 * These functions don't import any server-only modules
 */

import type { LLMProvider } from './types';

/**
 * Get default model for a provider
 * Client-safe: Only uses environment variables, no server-only imports
 */
export function getDefaultModel(provider: LLMProvider): string {
  // Note: In client code, these will use Next.js public env vars or defaults
  // In server code, they'll use process.env
  switch (provider) {
    case 'openai':
      return process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini';
    case 'anthropic':
      return process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest';
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Get available models for a provider
 * Client-safe: Pure function with no dependencies
 * 
 * Note: Claude Sonnet 4 models (claude-sonnet-4-5) support up to 1M tokens context window,
 * while other models support 200K tokens.
 */
export function getAvailableModels(provider: LLMProvider): string[] {
  switch (provider) {
    case 'openai':
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ];
    case 'anthropic':
      return [
        'claude-sonnet-4-5', // 1M tokens context window
        'claude-sonnet-4-5-20250929', // 1M tokens context window
        'claude-3-7-sonnet-latest', // 200K tokens
        'claude-3-7-sonnet-20250219', // 200K tokens
        'claude-3-5-haiku-latest', // 200K tokens
        'claude-3-5-haiku-20241022', // 200K tokens
        'claude-3-opus-latest', // 200K tokens
        'claude-3-opus-20240229', // 200K tokens
      ];
    default:
      return [];
  }
}
