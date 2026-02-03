/**
 * MCP Tool utilities
 * Converts skills to MCP tool format and extracts input parameters
 */

import type { Skill, SkillVersion } from '@prisma/client';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * Extract variable names from prompt content using {{variable_name}} pattern
 */
export function extractVariables(content: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Convert a skill to MCP tool format
 */
export function skillToMCPTool(skill: Skill, version: SkillVersion): MCPTool {
  const variables = extractVariables(version.content);
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  // Create input schema from variables found in prompt
  for (const variable of variables) {
    properties[variable] = {
      type: 'string',
      description: `Value for ${variable}`,
    };
    required.push(variable);
  }

  // Convert skill name to tool name (lowercase, underscores, no special chars)
  const toolName = skill.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return {
    name: toolName,
    description: skill.description || `Skill: ${skill.name}`,
    inputSchema: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * Sanitize input value to prevent injection attacks
 */
function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Remove potential script tags and event handlers
  str = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Escape special characters that could break the template
  // But preserve basic formatting
  str = str
    .replace(/\{\{/g, '&#123;&#123;') // Escape {{ to prevent template injection
    .replace(/\}\}/g, '&#125;&#125;'); // Escape }} to prevent template injection

  // Limit length to prevent DoS
  if (str.length > 10000) {
    str = str.substring(0, 10000) + '... [truncated]';
  }

  return str;
}

/**
 * Merge user input into prompt content
 * Input values are sanitized to prevent injection attacks
 * If inputs are provided but not referenced in the prompt template, append them
 */
export function mergePromptWithInput(
  prompt: string,
  input: Record<string, unknown>
): string {
  let merged = prompt;
  const usedKeys = new Set<string>();

  // Replace {{variable}} with sanitized actual values
  for (const [key, value] of Object.entries(input)) {
    // Validate key name (alphanumeric and underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      continue; // Skip invalid keys
    }

    const placeholder = `{{${key}}}`;
    if (merged.includes(placeholder)) {
      const replacement = sanitizeInput(value);
      merged = merged.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        replacement
      );
      usedKeys.add(key);
    }
  }

  // Append any inputs that weren't referenced in the template
  const unusedInputs: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (!usedKeys.has(key) && value !== null && value !== undefined && value !== '') {
      const sanitized = sanitizeInput(value);
      if (sanitized.length > 0) {
        unusedInputs.push(`\n\n## ${key.charAt(0).toUpperCase() + key.slice(1)}\n${sanitized}`);
      }
    }
  }

  if (unusedInputs.length > 0) {
    merged += '\n\n---\n## Provided Inputs\n' + unusedInputs.join('\n');
  }

  return merged;
}
