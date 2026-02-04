/**
 * Function Calling Utilities
 * Converts app actions to LLM function calling format
 */

import type { ActionDefinition } from './types';
import type { LLMFunction } from '@/lib/llm/types';

/**
 * Convert an app action to an LLM function definition
 */
export function actionToFunction(
  action: ActionDefinition,
  appId: string
): LLMFunction {
  // Create a unique function name that includes the app ID
  // OpenAI requires function names to match pattern: ^[a-zA-Z0-9_-]+$
  // So we use underscore instead of colon
  const functionName = `${appId}_${action.name}`;

  // Ensure inputSchema has required structure
  const inputSchema = action.inputSchema || {};
  
  // Ensure it's a proper JSON Schema object
  const parameters: Record<string, unknown> = {
    type: 'object',
    properties: inputSchema.properties || {},
    required: inputSchema.required || [],
  };

  return {
    name: functionName,
    description: action.description,
    parameters,
  };
}

/**
 * Convert multiple app actions to LLM function definitions
 */
export function actionsToFunctions(
  actions: ActionDefinition[],
  appId: string
): LLMFunction[] {
  return actions.map(action => actionToFunction(action, appId));
}
