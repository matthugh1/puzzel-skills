/**
 * MCP Handler: Call Tool
 * Executes a skill by merging user input into the prompt and calling LLM
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mergePromptWithInput } from '../tools';
import { audit } from '@/lib/audit';
import { callLLM, getDefaultModel, type LLMProvider } from '@/lib/llm';
import { addExecutionLog } from '@/lib/runtime/execution-logger';
import { isFileReference, getFileMetadata } from '@/lib/file-storage';
import { toolsRegistry } from '@/lib/tools';
import type { FileAttachment } from '@/lib/llm';

interface CallToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export async function handleCallTool(
  request: CallToolRequest,
  userId: string,
  httpRequest: Request,
  runId?: string,
  stepIndex?: number,
  stepId?: string,
  llmProvider?: LLMProvider | null,
  llmModel?: string | null
): Promise<NextResponse> {
  try {
    const { name, arguments: args } = request;

    if (!name) {
      return NextResponse.json(
        { error: 'Tool name is required' },
        { status: 400 }
      );
    }

    // Find skill by matching tool name
    // Tool names are derived from skill names (lowercase, underscores)
    // First try to find by skillId/versionId if provided in run context (for test runs with unpublished skills)
    let skill: { id: string; name: string; versions: Array<{ id: string; version: number; content: string; metadata: unknown }> } | null = null;
    let publishedVersion: { id: string; version: number; content: string; metadata: unknown } | null = null;

    // If we have stepId, try to load the skill from the run step (allows unpublished skills in test runs)
    if (stepId) {
      const runStep = await db.runStep.findUnique({
        where: { id: stepId },
        include: {
          skillVersion: {
            include: {
              skill: true,
              metadata: true,
            },
          },
        },
      });

      if (runStep?.skillVersion) {
        const sv = runStep.skillVersion;
        const skillToolName = sv.skill.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        
        // Verify the skill name matches the requested tool name
        if (skillToolName === name) {
          skill = {
            id: sv.skill.id,
            name: sv.skill.name,
            versions: [{
              id: sv.id,
              version: sv.version,
              content: sv.content,
              metadata: sv.metadata,
            }],
          };
          publishedVersion = skill.versions[0];
          console.error(`[MCP Handler] ✅ Found skill via stepId: ${skill.name} (version ${publishedVersion.version})`);
        } else {
          console.error(`[MCP Handler] ⚠️ Skill name mismatch: expected "${name}", got "${skillToolName}"`);
        }
      }
    }

    // Fallback: find published skill by name (for published workflows)
    if (!skill) {
      const allSkills = await db.skill.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'ORG',
        },
        include: {
          versions: {
            where: {
              status: 'PUBLISHED',
            },
            orderBy: {
              version: 'desc',
            },
            take: 1,
            include: {
              metadata: true,
            },
          },
        },
      });

      // Find matching skill by converting skill names to tool names
      const foundSkill = allSkills.find((s) => {
        const toolName = s.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        return toolName === name;
      });

      if (foundSkill && foundSkill.versions[0]) {
        skill = {
          id: foundSkill.id,
          name: foundSkill.name,
          versions: [{
            id: foundSkill.versions[0].id,
            version: foundSkill.versions[0].version,
            content: foundSkill.versions[0].content,
            metadata: foundSkill.versions[0].metadata,
          }],
        };
        publishedVersion = skill.versions[0];
        console.error(`[MCP Handler] Found published skill: ${skill.name} (version ${publishedVersion.version})`);
      }
    }

    if (!skill || !publishedVersion) {
      return NextResponse.json(
        { error: `Tool "${name}" not found` },
        { status: 404 }
      );
    }

    // Extract file attachments from arguments before merging prompt
    // Files will be sent natively to LLM APIs instead of being embedded as text
    const fileAttachments: FileAttachment[] = [];
    const argsWithoutFiles: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(args || {})) {
      if (isFileReference(value)) {
        try {
          const metadata = await getFileMetadata(value);
          fileAttachments.push({
            ref: value,
            metadata,
          });
          console.error(`[MCP Handler] Detected file attachment: ${metadata.name} (${metadata.mimeType})`);
        } catch (error) {
          console.error(`[MCP Handler] Error processing file attachment ${key}:`, error);
          // Continue without this file attachment
        }
      } else {
        // Keep non-file arguments for prompt merging
        argsWithoutFiles[key] = value;
      }
    }

    // Check if skill uses a tool (via metadata)
    // toolId can be in executorConfig.toolId or directly in metadata (for backward compatibility)
    const skillMetadata = publishedVersion.metadata as Record<string, unknown> | null;
    const executorConfig = skillMetadata?.executorConfig as Record<string, unknown> | undefined;
    const toolId = (executorConfig?.toolId || skillMetadata?.toolId) as string | undefined;

    console.error(`[MCP Handler] Skill "${skill.name}" metadata check:`, {
      hasMetadata: !!skillMetadata,
      executorConfig,
      toolId,
      toolIdInRegistry: toolId ? toolsRegistry.has(toolId) : false,
      availableTools: toolsRegistry.getAll().map(t => t.id),
    });

    // If skill references a tool, execute it instead of LLM
    if (toolId && toolsRegistry.has(toolId)) {
      console.error(`[MCP Handler] Executing tool "${toolId}" for skill "${skill.name}"`, {
        runId,
        stepIndex,
        stepId,
        userId,
        argsKeys: Object.keys(argsWithoutFiles),
      });
      
      if (runId) {
        await addExecutionLog(runId, {
          level: 'info',
          stepIndex,
          stepId,
          message: `Executing tool: ${toolId}`,
          details: {
            toolId,
            skillName: skill.name,
            arguments: Object.keys(argsWithoutFiles),
          },
        });
      } else {
        console.error(`[MCP Handler] ⚠️ WARNING: runId is undefined! Tool execution may fail.`);
      }

      // Execute tool
      const toolResult = await toolsRegistry.execute(
        toolId,
        argsWithoutFiles,
        {
          runId: runId || '', // Ensure runId is at least an empty string, not undefined
          stepIndex,
          stepId,
          userId,
        }
      );
      
      console.error(`[MCP Handler] Tool execution result:`, {
        success: toolResult.success,
        hasOutput: !!toolResult.output,
        outputLength: toolResult.output?.length,
        metadata: toolResult.metadata,
        error: toolResult.error,
      });

      if (!toolResult.success) {
        if (runId) {
          await addExecutionLog(runId, {
            level: 'error',
            stepIndex,
            stepId,
            message: `Tool execution failed: ${toolId}`,
            details: {
              toolId,
              error: toolResult.error,
            },
          });
        }
        return NextResponse.json(
          {
            error: toolResult.error || 'Tool execution failed',
            content: [
              {
                type: 'text',
                text: toolResult.output || '',
              },
            ],
          },
          { status: 500 }
        );
      }

      // Log success
      if (runId) {
        await addExecutionLog(runId, {
          level: 'info',
          stepIndex,
          stepId,
          message: `Tool executed successfully: ${toolId}`,
          details: {
            toolId,
            metadata: toolResult.metadata,
          },
        });
      }

      // Return tool output
      return NextResponse.json({
        content: [
          {
            type: 'text',
            text: toolResult.output,
          },
        ],
        metadata: {
          toolId,
          toolExecuted: true,
          ...toolResult.metadata,
        },
      });
    } else if (toolId) {
      // Tool ID is configured but not found in registry
      console.error(`[MCP Handler] ⚠️ Skill "${skill.name}" has toolId "${toolId}" but tool is not registered. Available tools:`, toolsRegistry.getAll().map(t => t.id));
    } else {
      // No tool configured - will use LLM
      console.error(`[MCP Handler] ℹ️ Skill "${skill.name}" has no toolId configured - using LLM`);
    }

    // Merge user input into prompt (excluding file references)
    const mergedPrompt = mergePromptWithInput(publishedVersion.content, argsWithoutFiles);

    // Log audit
    await audit.mcpSkillExecuted(
      skill.id,
      userId,
      {
        toolName: name,
        skillName: skill.name,
        version: publishedVersion.version,
        arguments: args,
      },
      httpRequest
    );

    // Determine LLM provider and model from workflow config or defaults
    const provider: LLMProvider = (llmProvider as LLMProvider) || 'openai';
    const model = llmModel || getDefaultModel(provider);

    // Check if API key is configured for the selected provider
    const hasAPIKey =
      provider === 'openai'
        ? !!process.env.OPENAI_API_KEY
        : !!process.env.ANTHROPIC_API_KEY;

    if (!hasAPIKey) {
      // If no API key, return merged prompt (fallback behavior)
      if (runId) {
        await addExecutionLog(runId, {
          level: 'warn',
          stepIndex,
          stepId,
          message: `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key not configured - returning merged prompt without LLM call`,
          details: {
            provider,
            note: `Set ${provider === 'openai' ? 'OPENAI' : 'ANTHROPIC'}_API_KEY environment variable to enable LLM execution`,
          },
        });
      }

      return NextResponse.json({
        content: [
          {
            type: 'text',
            text: mergedPrompt,
          },
        ],
      });
    }

    // Call LLM with merged prompt and file attachments
    try {
      console.error(`[MCP Handler] Calling LLM (${provider}/${model}) for run ${runId}, step ${stepIndex} with ${fileAttachments.length} file attachment(s)`);
      const llmResponse = await callLLM(
        mergedPrompt,
        {
          provider,
          model,
          temperature: 0.7,
          maxTokens: 2000,
          files: fileAttachments.length > 0 ? fileAttachments : undefined,
        },
        runId,
        stepIndex,
        stepId
      );
      console.error(`[MCP Handler] LLM call completed, response length: ${llmResponse.content.length} for run ${runId}`);

      // Return LLM response in MCP format
      return NextResponse.json({
        content: [
          {
            type: 'text',
            text: llmResponse.content,
          },
        ],
        metadata: {
          provider,
          model: llmResponse.model,
          usage: llmResponse.usage,
          finishReason: llmResponse.finishReason,
        },
      });
    } catch (llmError) {
      // If LLM call fails, log error and return merged prompt as fallback
      if (runId) {
        await addExecutionLog(runId, {
          level: 'error',
          stepIndex,
          stepId,
          message: `LLM call failed (${provider}) - returning merged prompt as fallback`,
          details: {
            provider,
            model,
            error: llmError instanceof Error ? llmError.message : String(llmError),
          },
        });
      }

      // Return merged prompt as fallback
      return NextResponse.json({
        content: [
          {
            type: 'text',
            text: mergedPrompt,
          },
        ],
        error: `LLM call failed (${provider}), returned merged prompt`,
      });
    }
  } catch (error) {
    console.error('Error calling MCP tool:', error);
    return NextResponse.json(
      { error: 'Failed to execute tool' },
      { status: 500 }
    );
  }
}
