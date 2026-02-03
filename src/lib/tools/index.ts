/**
 * Tools Module
 * Exports tools registry and all registered tools
 */

// Import registry - this creates the singleton instance
import { toolsRegistry } from './registry';

// Import tool definitions
import { documentGeneratorTool } from './document-generator';

// Register all tools
// Check if already registered to avoid duplicate registration errors
if (!toolsRegistry.has(documentGeneratorTool.id)) {
  try {
    toolsRegistry.register(documentGeneratorTool);
  } catch (error) {
    console.error('[Tools] Error registering document generator tool:', error);
  }
}

// Export registry and types
export { toolsRegistry };
export type { Tool, ToolResult, ToolContext, ToolExecutor } from './types';
