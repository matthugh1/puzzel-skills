/**
 * Tools Registry
 * Central registry for reusable tools that can be executed by skills
 */

import type { Tool, ToolResult, ToolContext } from './types';

class ToolsRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with id "${tool.id}" is already registered`);
    }
    this.tools.set(tool.id, tool);
    console.log(`[ToolsRegistry] Registered tool: ${tool.id} (${tool.name})`);
  }

  /**
   * Get a tool by ID
   */
  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  has(id: string): boolean {
    return this.tools.has(id);
  }

  /**
   * Execute a tool
   */
  async execute(
    toolId: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool "${toolId}" not found`,
      };
    }

    try {
      // Validate required arguments
      const required = tool.inputSchema.required || [];
      for (const field of required) {
        if (!(field in args) || args[field] === null || args[field] === undefined || args[field] === '') {
          return {
            success: false,
            output: '',
            error: `Required argument "${field}" is missing`,
          };
        }
      }

      // Execute tool
      return await tool.executor(args, context);
    } catch (error) {
      console.error(`[ToolsRegistry] Error executing tool "${toolId}":`, error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Singleton instance
export const toolsRegistry = new ToolsRegistry();
