/**
 * Context Resolver
 * Resolves runtime references ($context.*, $step.N.output.*, @previous.*)
 * Distinct from {{variable}} template syntax used in skill prompts
 */

import type { RunStep } from '@prisma/client';
import { isFileReference, loadFile, getFileMetadata } from '@/lib/file-storage';
import type { FileAttachment } from '@/lib/llm';

export interface ResolvedContext {
  [key: string]: unknown;
}

/**
 * Resolve runtime references in input context
 * 
 * Reference syntax:
 * - $context.<field> → initialContext[field]
 * - $step.N.output.raw → RunStep[N].outputContext.raw
 * - $step.N.output.data.<field> → RunStep[N].outputContext.data[field]
 * - @previous.output.raw → previous step's outputContext.raw
 * - @previous.output.data.<field> → previous step's outputContext.data[field]
 * 
 * File references:
 * - If loadFileContent is true and a value is a file reference (__file__:path), it will be loaded from disk
 * - If loadFileContent is false, file references are kept as-is (for database storage)
 */
export async function resolveContext(
  inputContext: Record<string, unknown>,
  initialContext: Record<string, unknown>,
  previousSteps: Array<Pick<RunStep, 'outputContext' | 'stepIndex'>>,
  loadFileContent: boolean = true
): Promise<ResolvedContext> {
  const resolved: ResolvedContext = {};

  for (const [key, value] of Object.entries(inputContext)) {
    if (typeof value === 'string') {
      resolved[key] = await resolveReference(value, initialContext, previousSteps, loadFileContent);
    } else {
      resolved[key] = value; // Non-string values passed through
    }
  }

  return resolved;
}

/**
 * Resolve a single reference string
 * Returns the resolved value, loading files if loadFileContent is true
 */
async function resolveReference(
  value: string,
  initialContext: Record<string, unknown>,
  previousSteps: Array<Pick<RunStep, 'outputContext' | 'stepIndex'>>,
  loadFileContent: boolean = true
): Promise<unknown> {
  // $context.<field>
  const contextMatch = value.match(/^\$context\.(\w+)$/);
  if (contextMatch && contextMatch[1]) {
    const field = contextMatch[1];
    const contextValue = initialContext[field] ?? null;
    
    // If the context value is a file reference, load it only if requested
    if (isFileReference(contextValue)) {
      if (loadFileContent) {
        try {
          return await loadFile(contextValue);
        } catch (error) {
          console.error(`[ContextResolver] Error loading file ${contextValue}:`, error);
          return null;
        }
      } else {
        // Keep file reference as-is (for database storage)
        return contextValue;
      }
    }
    
    return contextValue;
  }

  // $step.N.output.raw
  const stepRawMatch = value.match(/^\$step\.(\d+)\.output\.raw$/);
  if (stepRawMatch && stepRawMatch[1]) {
    const stepIndex = parseInt(stepRawMatch[1], 10);
    const step = previousSteps.find((s) => s.stepIndex === stepIndex);
    if (step?.outputContext && typeof step.outputContext === 'object') {
      const outputCtx = step.outputContext as { raw?: string };
      return outputCtx.raw ?? null;
    }
    return null;
  }

  // $step.N.output.data.<field>
  const stepDataMatch = value.match(/^\$step\.(\d+)\.output\.data\.(\w+)$/);
  if (stepDataMatch && stepDataMatch[1] && stepDataMatch[2]) {
    const stepIndex = parseInt(stepDataMatch[1], 10);
    const field = stepDataMatch[2];
    const step = previousSteps.find((s) => s.stepIndex === stepIndex);
    if (step?.outputContext && typeof step.outputContext === 'object') {
      const outputCtx = step.outputContext as { data?: Record<string, unknown> };
      return outputCtx.data?.[field] ?? null;
    }
    return null;
  }

  // @previous.output.raw
  if (value === '@previous.output.raw') {
    const previousStep = previousSteps[previousSteps.length - 1];
    if (previousStep?.outputContext && typeof previousStep.outputContext === 'object') {
      const outputCtx = previousStep.outputContext as { raw?: string };
      return outputCtx.raw ?? null;
    }
    return null;
  }

  // @previous.output.data.<field>
  const previousDataMatch = value.match(/^@previous\.output\.data\.(\w+)$/);
  if (previousDataMatch && previousDataMatch[1]) {
    const field = previousDataMatch[1];
    const previousStep = previousSteps[previousSteps.length - 1];
    if (previousStep?.outputContext && typeof previousStep.outputContext === 'object') {
      const outputCtx = previousStep.outputContext as { data?: Record<string, unknown> };
      return outputCtx.data?.[field] ?? null;
    }
    return null;
  }

  // Not a reference, return as-is
  return value;
}

/**
 * Extract file attachments from resolved context
 * Returns an array of FileAttachment objects for files found in the context
 */
export async function extractFileAttachments(
  resolvedContext: ResolvedContext
): Promise<FileAttachment[]> {
  const attachments: FileAttachment[] = [];

  for (const [key, value] of Object.entries(resolvedContext)) {
    // Check if value is a file reference
    if (isFileReference(value)) {
      try {
        const metadata = await getFileMetadata(value);
        attachments.push({
          ref: value,
          metadata,
        });
      } catch (error) {
        console.error(`[ContextResolver] Error getting file metadata for ${value}:`, error);
        // Continue without this file attachment
      }
    }
  }

  return attachments;
}
