/**
 * LLM Types
 * Type definitions for LLM service (no server-only dependencies)
 * This file can be safely imported in client code
 */

import type { FileAttachment } from '../file-storage-types';

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  files?: FileAttachment[]; // File attachments for native API support
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export interface LLMError {
  message: string;
  code?: string;
  statusCode?: number;
}

export type LLMProvider = 'openai' | 'anthropic';

export interface UnifiedLLMConfig extends LLMConfig {
  provider: LLMProvider;
}

// Re-export file attachment type for convenience
export type { FileAttachment } from '../file-storage-types';
