/**
 * Integration Types
 * Type definitions for app integrations
 */

export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  apiKey?: string;
  [key: string]: unknown; // Allow additional credential fields
}

export interface ActionInput {
  [key: string]: unknown;
}

export interface ActionOutput {
  [key: string]: unknown;
}

export interface ActionDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema: Record<string, unknown>; // JSON Schema
  requiresAuth?: boolean;
}

export interface IntegrationError {
  message: string;
  code: string;
  retryable: boolean;
}
