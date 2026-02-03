/**
 * Interpreter Layer
 * Transforms skill outputs based on outputContract metadata
 * Enforces strict JSON parsing for JSON outputs
 */

import type { SkillVersionMetadata } from '@prisma/client';

export interface InterpretedOutput {
  raw: string | null;
  data: Record<string, unknown> | null;
  artefactType: 'PROMPT_OUTPUT' | 'EXECUTOR_OUTPUT' | 'TOOL_REQUEST';
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface InterpretationError {
  message: string;
  code: 'INVALID_JSON' | 'SCHEMA_VALIDATION_FAILED' | 'PARSE_ERROR';
}

/**
 * Interpret skill output based on metadata
 */
export function interpretOutput(
  rawOutput: string,
  metadata: SkillVersionMetadata | null
): { output: InterpretedOutput } | { error: InterpretationError } {
  // Default: text output
  if (!metadata || !metadata.outputContract) {
    return {
      output: {
        raw: rawOutput,
        data: null,
        artefactType: 'PROMPT_OUTPUT',
        sensitivity: 'LOW',
      },
    };
  }

  const contract = metadata.outputContract as {
    type?: 'text' | 'json';
    schema?: Record<string, unknown>;
  };

  // Text output
  if (contract.type === 'text' || !contract.type) {
    return {
      output: {
        raw: rawOutput,
        data: null,
        artefactType: 'PROMPT_OUTPUT',
        sensitivity: 'LOW',
      },
    };
  }

  // JSON output - strict parsing required
  if (contract.type === 'json') {
    // Strip whitespace but require entire output to be JSON
    const trimmed = rawOutput.trim();
    
    // Check if output contains non-JSON text (markdown, prose, etc.)
    // Simple heuristic: if it doesn't start with { or [, it's likely not pure JSON
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return {
        error: {
          message: 'Output must be valid JSON only (no surrounding text or markdown)',
          code: 'INVALID_JSON',
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return {
        error: {
          message: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'PARSE_ERROR',
        },
      };
    }

    // Basic schema validation (MVP: check if it's an object)
    if (contract.schema && typeof parsed === 'object' && parsed !== null) {
      // MVP: Basic validation - in production, use ajv or similar
      // For now, just ensure it's an object
      const parsedObj = parsed as Record<string, unknown>;
      
      // Check if schema indicates TOOL_REQUEST structure
      const schemaObj = contract.schema as { properties?: Record<string, unknown> };
      const isToolRequest = schemaObj.properties?.tool !== undefined;
      
      return {
        output: {
          raw: null, // Structured output, no raw text
          data: parsedObj,
          artefactType: isToolRequest ? 'TOOL_REQUEST' : 'EXECUTOR_OUTPUT',
          sensitivity: isToolRequest ? 'HIGH' : 'MEDIUM',
        },
      };
    }

    return {
      output: {
        raw: null,
        data: parsed as Record<string, unknown>,
        artefactType: 'EXECUTOR_OUTPUT',
        sensitivity: 'MEDIUM',
      },
    };
  }

  // Unknown contract type
  return {
    output: {
      raw: rawOutput,
      data: null,
      artefactType: 'PROMPT_OUTPUT',
      sensitivity: 'LOW',
    },
  };
}
