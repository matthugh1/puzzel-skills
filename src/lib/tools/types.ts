/**
 * Tools Registry Types
 * Defines the interface for reusable tools that can be executed by skills
 */

export interface ToolResult {
  success: boolean;
  output: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ToolContext {
  runId?: string;
  stepIndex?: number;
  stepId?: string;
  userId?: string;
}

/**
 * Tool execution function signature
 */
export type ToolExecutor = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;

/**
 * Tool definition
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
  executor: ToolExecutor;
}
