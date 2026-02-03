/**
 * Unified LLM Service
 * Provides a single interface for calling different LLM providers
 * 
 * Client-safe exports: getDefaultModel, getAvailableModels, and types
 * Server-only exports: callLLM (use dynamic import or server-only import)
 */

// Import types from types file (safe for client code)
import type { LLMConfig, LLMResponse, LLMError, LLMProvider, UnifiedLLMConfig, FileAttachment } from './types';

// Re-export types for convenience
export type { LLMConfig, LLMResponse, LLMError, LLMProvider, UnifiedLLMConfig, FileAttachment } from './types';

/**
 * Call LLM with unified interface
 * SERVER-ONLY: This function uses server-side modules
 * 
 * This function is only available server-side. Import it dynamically:
 * const { callLLM } = await import('@/lib/llm');
 */
export async function callLLM(
  prompt: string,
  config: UnifiedLLMConfig,
  runId?: string,
  stepIndex?: number,
  stepId?: string
): Promise<LLMResponse> {
  // Ensure this is only called server-side
  if (typeof window !== 'undefined') {
    throw new Error('callLLM can only be called server-side');
  }

  const { provider, files, ...llmConfig } = config;

  // Dynamic imports to avoid bundling server-only code in client
  switch (provider) {
    case 'openai': {
      const { callOpenAI } = await import('./openai');
      return callOpenAI(prompt, { ...llmConfig, files }, runId, stepIndex, stepId);
    }
    case 'anthropic': {
      const { callAnthropic } = await import('./anthropic');
      return callAnthropic(prompt, { ...llmConfig, files }, runId, stepIndex, stepId);
    }
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

// Re-export client-safe utilities
export { getDefaultModel, getAvailableModels } from './client';
