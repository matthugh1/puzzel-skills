/**
 * Tools Module
 * Exports tools registry and all registered tools
 */

// Import registry - this creates the singleton instance
import { toolsRegistry } from './registry';

// Import tool definitions
import { documentGeneratorTool } from './document-generator';
import {
  productboardListFeaturesTool,
  productboardGetFeatureTool,
  productboardCreateFeatureTool,
  productboardListComponentsTool,
} from './productboard';

// Register all tools
// Check if already registered to avoid duplicate registration errors
const toolsToRegister = [
  documentGeneratorTool,
  productboardListFeaturesTool,
  productboardGetFeatureTool,
  productboardCreateFeatureTool,
  productboardListComponentsTool,
];

for (const tool of toolsToRegister) {
  if (!toolsRegistry.has(tool.id)) {
    try {
      toolsRegistry.register(tool);
    } catch (error) {
      console.error(`[Tools] Error registering tool "${tool.id}":`, error);
    }
  }
}

// Export registry and types
export { toolsRegistry };
export type { Tool, ToolResult, ToolContext, ToolExecutor } from './types';
