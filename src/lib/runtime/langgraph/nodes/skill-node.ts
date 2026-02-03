/**
 * Skill Step Node for LangGraph
 * Executes a skill within a workflow
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';
import { resolveContext } from '../../context-resolver';
import { interpretOutput } from '../../interpreter';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { handleCallTool } from '@/app/api/mcp/handlers/call';
import { addExecutionLog } from '../../execution-logger';
import { isFileReference } from '@/lib/file-storage';

export function createSkillNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { skillId, skillVersionId, inputs } = step.config || {};

    if (!skillId) {
      const errorMsg = `Skill step (id: ${step.id}, type: ${step.type}) missing skillId. Config: ${JSON.stringify(step.config)}`;
      console.error(`🚀 WORKFLOW-EXECUTOR ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Load skill - try by ID first, then by name if it looks like a name/identifier
    let skill = await db.skill.findUnique({
      where: { id: skillId },
      include: {
        versions: {
          orderBy: { version: 'desc' }, // Order by version descending
          include: { metadata: true },
        },
      },
    });

    // If not found by ID, try to find by name (for backward compatibility)
    if (!skill) {
      const skills = await db.skill.findMany({
        where: {
          name: {
            equals: skillId,
            mode: 'insensitive',
          },
        },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { metadata: true },
          },
        },
      });
      skill = skills[0]; // Take first match
    }

    // If still not found, try to find by a normalized name match
    if (!skill) {
      const normalizedName = skillId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const skills = await db.skill.findMany({
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { metadata: true },
          },
        },
      });
      skill = skills.find((s) => 
        s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalizedName
      );
    }

    // Determine which version to use
    let skillVersion;
    if (skillVersionId) {
      // Use specified version
      skillVersion = skill?.versions.find((v) => v.id === skillVersionId);
      if (!skillVersion && skill) {
        // Try finding by version number if ID doesn't match
        const versionNum = parseInt(skillVersionId, 10);
        if (!isNaN(versionNum)) {
          skillVersion = skill.versions.find((v) => v.version === versionNum);
        }
      }
    } else {
      // Use latest published version, or latest version if none published
      if (skill?.versions && skill.versions.length > 0) {
        skillVersion = skill.versions.find((v) => v.status === 'PUBLISHED') || skill.versions[0];
      }
    }

    if (!skillVersion && skill?.versions && skill.versions.length > 0) {
      // Fallback to latest version
      skillVersion = skill.versions[0];
    }

    if (!skill || !skillVersion) {
      const PREFIX = '🚀 WORKFLOW-EXECUTOR';
      console.error(`${PREFIX} Skill or version not found: skillId=${skillId}, skillVersionId=${skillVersionId || 'none'}`);
      return {
        status: 'FAILED' as const,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'FAILED',
            inputContext: inputs || {},
            errorMessage: 'Skill or version not found',
            completedAt: new Date(),
          },
        ],
      };
    }

    const PREFIX = '🚀 WORKFLOW-EXECUTOR';
    console.error(`${PREFIX} Executing skill: ${skill.name} (version ${skillVersion.version})`);
    
    await addExecutionLog(state.runId, {
      level: 'info',
      stepIndex: state.currentStepIndex,
      stepId: step.id,
      message: `Starting execution of skill: ${skill.name}`,
      details: { skillId: skill.id, skillVersionId: skillVersion.id },
    });

    // Extract required variables from skill content
    const variablePattern = /\{\{(\w+)\}\}/g;
    const requiredVariables = new Set<string>();
    let match;
    while ((match = variablePattern.exec(skillVersion.content)) !== null) {
      requiredVariables.add(match[1]);
    }

    // Also check preferredInputs from skill metadata (for skills that need input but don't use template variables)
    const metadata = skillVersion.metadata;
    if (metadata?.preferredInputs && Array.isArray(metadata.preferredInputs)) {
      const preferredInputs = metadata.preferredInputs as string[];
      preferredInputs.forEach((input) => {
        if (typeof input === 'string') {
          requiredVariables.add(input);
        }
      });
    }

    await addExecutionLog(state.runId, {
      level: 'info',
      stepIndex: state.currentStepIndex,
      stepId: step.id,
      message: `Extracted required variables from skill content and metadata`,
      details: { 
        requiredVariables: Array.from(requiredVariables),
        fromTemplate: Array.from(requiredVariables).filter(v => skillVersion.content.includes(`{{${v}}}`)),
        fromMetadata: metadata?.preferredInputs || [],
      },
    });

    // Resolve input context
    const previousSteps = state.steps.map((s) => ({
      stepIndex: s.stepIndex as number,
      outputContext: (s.outputContext as Record<string, unknown>) || null,
    }));

    // Auto-map inputs: if step.inputs is empty, automatically map from initialContext and previous steps
    // Priority 1: Map ALL file references (uploaded files) - regardless of field name
    // Priority 2: Map from previous step outputs (if available)
    // Priority 3: Map required variables from initialContext (if not already mapped)
    // Priority 4: Map any other non-empty string values from initialContext
    let inputsToResolve = (inputs as Record<string, unknown>) || {};
    if (Object.keys(inputsToResolve).length === 0) {
      const autoMapped: Record<string, unknown> = {};
      const availableContext = state.initialContext || {};
      const contextKeys = Object.keys(availableContext);
      
      // Get the previous step (most recent completed step)
      const previousStep = previousSteps.length > 0 ? previousSteps[previousSteps.length - 1] : null;
      const previousStepIndex = previousStep?.stepIndex ?? -1;
      
      // Priority 1: Map ALL file references (uploaded files) - any field name
      for (const key of contextKeys) {
        // Skip system/internal fields
        if (key.startsWith('__') || key === 'metadata') continue;
        
        const value = availableContext[key];
        // If it's a file reference, auto-map it (regardless of field name)
        if (isFileReference(value)) {
          autoMapped[key] = `$context.${key}`;
        }
      }
      
      // Priority 2: Map from previous step outputs (if available and required variables not yet mapped)
      if (previousStep && previousStep.outputContext && requiredVariables.size > 0) {
        const prevOutputCtx = previousStep.outputContext as { raw?: string; data?: Record<string, unknown> };
        
        // First, check if previous step has data fields that match required variables exactly
        if (prevOutputCtx.data && typeof prevOutputCtx.data === 'object') {
          for (const variable of requiredVariables) {
            if (!(variable in autoMapped) && variable in prevOutputCtx.data) {
              const dataValue = prevOutputCtx.data[variable];
              // Map if it's a non-empty string or file reference
              if ((typeof dataValue === 'string' && dataValue.trim().length > 0) || isFileReference(dataValue)) {
                autoMapped[variable] = `$step.${previousStepIndex}.output.data.${variable}`;
              }
            }
          }
        }
        
        // If we still have unmapped required variables, try to map from any non-empty string in previous step's data
        // This handles cases where step 1 outputs "file" but step 2 needs "content"
        if (prevOutputCtx.data && typeof prevOutputCtx.data === 'object') {
          const textContentVars = ['content', 'text', 'input', 'data', 'output', 'response', 'message'];
          for (const variable of requiredVariables) {
            if (!(variable in autoMapped) && textContentVars.includes(variable.toLowerCase())) {
              // Look for any non-empty string value in previous step's data
              for (const [dataKey, dataValue] of Object.entries(prevOutputCtx.data)) {
                if (typeof dataValue === 'string' && dataValue.trim().length > 0 && !isFileReference(dataValue)) {
                  autoMapped[variable] = `$step.${previousStepIndex}.output.data.${dataKey}`;
                  break; // Map to first available non-empty string
                }
              }
            }
          }
        }
        
        // Finally, check if previous step has raw output (fallback if data fields don't match)
        if (prevOutputCtx.raw && typeof prevOutputCtx.raw === 'string' && prevOutputCtx.raw.trim().length > 0) {
          // Map to first required variable that expects text content (like "content") and isn't already mapped
          for (const variable of requiredVariables) {
            if (!(variable in autoMapped)) {
              // Check if variable name suggests it wants text content (content, text, input, data, output, response)
              const textContentVars = ['content', 'text', 'input', 'data', 'output', 'response', 'message'];
              if (textContentVars.includes(variable.toLowerCase())) {
                autoMapped[variable] = `$step.${previousStepIndex}.output.raw`;
                break; // Map to first matching variable
              }
            }
          }
        }
      }
      
      // Priority 3: Map required variables from initialContext (if not already mapped)
      if (requiredVariables.size > 0) {
        for (const variable of requiredVariables) {
          if (variable in availableContext && !(variable in autoMapped)) {
            autoMapped[variable] = `$context.${variable}`;
          }
        }
      }
      
      // Priority 4: Map any other non-empty string values (if no files and no required variables mapped yet)
      if (Object.keys(autoMapped).length === 0) {
        for (const key of contextKeys) {
          // Skip system/internal fields
          if (key.startsWith('__') || key === 'metadata') continue;
          
          const value = availableContext[key];
          // Map if it's a non-empty string (but NOT a file reference - those are handled above)
          if (typeof value === 'string' && value.length > 0 && !isFileReference(value)) {
            autoMapped[key] = `$context.${key}`;
          }
        }
      }
      
      if (Object.keys(autoMapped).length > 0) {
        inputsToResolve = autoMapped;
        await addExecutionLog(state.runId, {
          level: 'info',
          stepIndex: state.currentStepIndex,
          stepId: step.id,
          message: `Auto-mapped inputs`,
          details: { 
            autoMapped: Object.keys(autoMapped), 
            mappingSources: Object.fromEntries(
              Object.entries(autoMapped).map(([k, v]) => [k, String(v)])
            ),
            availableInContext: contextKeys,
            previousStepIndex: previousStepIndex >= 0 ? previousStepIndex : null,
            previousStepHasOutput: previousStep ? !!previousStep.outputContext : false,
            fileReferences: contextKeys.filter(k => isFileReference(availableContext[k])),
            reason: contextKeys.some(k => isFileReference(availableContext[k])) ? 'all-file-references' : 
                    previousStep && previousStep.outputContext ? 'previous-step-output' :
                    requiredVariables.size > 0 ? 'skill-declared-inputs' : 
                    'non-empty-strings',
          },
        });
      }
    }

    // Resolve input context - keep file references as-is (don't load as text)
    // Files will be sent natively to LLM APIs instead of being converted to text
    const resolvedInputsForStorage = await resolveContext(
      inputsToResolve,
      state.initialContext,
      previousSteps,
      false // Don't load file content - keep references
    );
    
    // For execution, also keep file references (don't load as text)
    // The MCP handler will detect file references and send them natively to LLM APIs
    const resolvedInputsForExecution = await resolveContext(
      inputsToResolve,
      state.initialContext,
      previousSteps,
      false // Keep file references - don't load as text (files sent natively to LLM)
    );

    await addExecutionLog(state.runId, {
      level: 'info',
      stepIndex: state.currentStepIndex,
      stepId: step.id,
      message: `Resolved input context`,
      details: { 
        providedInputs: Object.keys(inputs || {}),
        resolvedInputs: Object.keys(resolvedInputsForExecution),
        inputValues: Object.fromEntries(
          Object.entries(resolvedInputsForExecution).map(([k, v]) => [
            k,
            isFileReference(v) ? '[FILE_REFERENCE]' : (typeof v === 'string' && v.length > 100 ? v.substring(0, 100) + '...' : v)
          ])
        ),
        availableContextKeys: Object.keys(state.initialContext || {}),
        stepInputsConfig: inputs || {},
      },
    });

    // Validate required inputs (use execution inputs for validation)
    const missingInputs: string[] = [];
    for (const variable of requiredVariables) {
      if (!(variable in resolvedInputsForExecution) || resolvedInputsForExecution[variable] === null || resolvedInputsForExecution[variable] === undefined || resolvedInputsForExecution[variable] === '') {
        missingInputs.push(variable);
      }
    }

    if (missingInputs.length > 0) {
      const errorMessage = `Missing required inputs: ${missingInputs.join(', ')}. Required variables: ${Array.from(requiredVariables).join(', ')}. Provided inputs: ${Object.keys(resolvedInputsForExecution).join(', ')}`;
      console.error(`${PREFIX} ❌ ${errorMessage}`);
      
      await addExecutionLog(state.runId, {
        level: 'error',
        stepIndex: state.currentStepIndex,
        stepId: step.id,
        message: `Input validation failed: Missing required inputs`,
        details: {
          missingInputs,
          requiredVariables: Array.from(requiredVariables),
          providedInputs: Object.keys(resolvedInputsForExecution),
        },
      });
      
      // Resolve inputs for storage (keep file references, don't load content)
      const resolvedInputsForStorage = await resolveContext(
        inputsToResolve,
        state.initialContext,
        previousSteps,
        false // Don't load file content - keep references
      );

      const stepIndex = typeof state.currentStepIndex === 'number' ? state.currentStepIndex : 0;

      // Create step record with FAILED status
      // Store file references (not content) in database
      const failedStep = await db.runStep.create({
        data: {
          runId: state.runId,
          stepIndex,
          skillId: skill.id,
          skillVersionId: skillVersion.id,
          skillVersionContentHash: createHash('sha256')
            .update(skillVersion.content)
            .digest('hex'),
          status: 'FAILED',
          inputContext: resolvedInputsForStorage, // File references, not content
          errorMessage,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Also update the run status to FAILED
      await db.agentRun.update({
        where: { id: state.runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          metadata: {
            ...(state.metadata || {}),
            validationError: errorMessage,
            failedAt: new Date().toISOString(),
          },
        },
      });

      return {
        status: 'FAILED' as const,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'FAILED',
            inputContext: resolvedInputsForStorage, // File references for state
            errorMessage,
            completedAt: new Date(),
          },
        ],
      };
    }

    console.error(`${PREFIX} ✅ All required inputs provided: ${Array.from(requiredVariables).join(', ')}`);
    
    await addExecutionLog(state.runId, {
      level: 'success',
      stepIndex: state.currentStepIndex,
      stepId: step.id,
      message: `Input validation passed: All required inputs provided`,
      details: { providedInputs: Object.keys(resolvedInputsForExecution) },
    });

    // Store file references (not content) in database
    // File references are preserved through execution and sent natively to LLM APIs
    const stepIndex = typeof state.currentStepIndex === 'number' ? state.currentStepIndex : 0;

    // Create step record (after validation passes)
    // Use resolvedInputsForStorage which keeps file references as-is
    const runStep = await db.runStep.create({
      data: {
        runId: state.runId,
        stepIndex,
        skillId: skill.id,
        skillVersionId: skillVersion.id,
        skillVersionContentHash: createHash('sha256')
          .update(skillVersion.content)
          .digest('hex'),
        status: 'RUNNING',
        inputContext: resolvedInputsForStorage, // File references, not content
        startedAt: new Date(),
      },
    });

    try {
      const PREFIX = '🚀 WORKFLOW-EXECUTOR';
      console.error(`${PREFIX} Calling MCP handler for skill: ${skill.name}`);
      
      await addExecutionLog(state.runId, {
        level: 'info',
        stepIndex: state.currentStepIndex,
        stepId: step.id,
        message: `Preparing to execute skill via MCP handler`,
        details: { skillName: skill.name },
      });
      
      // Execute skill via MCP handler
      const skillName = skill.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      const run = await db.agentRun.findUnique({
        where: { id: state.runId },
        select: { 
          userId: true,
          metadata: true,
          workflow: {
            select: {
              llmProvider: true,
              llmModel: true,
            },
          },
        },
      });

      if (!run) {
        throw new Error('Run not found');
      }

      // Check for test LLM overrides in metadata (for test runs)
      const runMetadata = (run.metadata as Record<string, unknown>) || {};
      const testLlmProvider = runMetadata.testLlmProvider as 'openai' | 'anthropic' | undefined;
      const testLlmModel = runMetadata.testLlmModel as string | undefined;
      
      // Use test LLM config if available, otherwise use workflow config
      const llmProvider = testLlmProvider || (run.workflow?.llmProvider as 'openai' | 'anthropic' | undefined);
      const llmModel = testLlmModel || run.workflow?.llmModel || undefined;

      // Create a mock request for MCP handler
      const mockRequest = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          name: skillName,
          arguments: resolvedInputsForExecution, // Use execution inputs (file references preserved for native API)
        }),
      });

      // Log arguments preview (truncate large file content for logging)
      const argsPreview = Object.fromEntries(
        Object.entries(resolvedInputsForExecution).map(([k, v]) => [
          k,
          typeof v === 'string' && v.length > 200 ? v.substring(0, 200) + '...' : v
        ])
      );
      console.error(`${PREFIX} MCP request: name=${skillName}, args=${JSON.stringify(argsPreview)}`);
      
      await addExecutionLog(state.runId, {
        level: 'info',
        stepIndex: state.currentStepIndex,
        stepId: step.id,
        message: `Calling MCP handler: ${skillName}`,
        details: { 
          toolName: skillName,
          arguments: Object.keys(resolvedInputsForExecution), // Just log keys, not content
        },
      });
      
      const mcpResponse = await handleCallTool(
        { name: skillName, arguments: resolvedInputsForExecution }, // Use execution inputs (file references preserved for native API)
        run.userId,
        mockRequest,
        state.runId,
        state.currentStepIndex,
        runStep.id, // Pass RunStep ID so MCP handler can look up skill version metadata
        llmProvider,
        llmModel
      );

      const mcpData = await mcpResponse.json();
      const rawOutput = mcpData.content?.[0]?.text || '';
      console.error(`${PREFIX} MCP response received, output length: ${rawOutput.length}`);
      console.error(`${PREFIX} MCP response metadata:`, JSON.stringify(mcpData.metadata || {}, null, 2));
      
      // Check if this is a tool execution with a file reference
      const isToolExecution = mcpData.metadata?.toolExecuted === true;
      const toolFileRef = (mcpData.metadata?.fileRef as string | undefined) || 
                          (isFileReference(rawOutput) ? rawOutput : undefined);
      const toolFileName = mcpData.metadata?.fileName as string | undefined;
      
      // If tool returned a file reference (in metadata or raw output), use it directly
      const shouldUseToolOutput = isToolExecution && toolFileRef && toolFileRef.startsWith('__file__:');
      
      // Check if LLM response indicates missing input
      const missingInputIndicators = [
        'please provide',
        'please share',
        'please send',
        'i need',
        'i require',
        'provide me',
        'share with me',
        'send me',
        'missing',
        'not provided',
        'would like me to analyze',
        'that you would like',
      ];
      const responseLower = rawOutput.toLowerCase();
      // Detect missing input if LLM asks for it OR if we have required variables but no inputs provided
      const llmAsksForInput = missingInputIndicators.some((indicator) =>
        responseLower.includes(indicator)
      );
      const hasRequiredButNoInputs = requiredVariables.size > 0 && Object.keys(resolvedInputsForExecution).length === 0;
      const indicatesMissingInput = llmAsksForInput || hasRequiredButNoInputs;

      await addExecutionLog(state.runId, {
        level: indicatesMissingInput ? 'warn' : 'info',
        stepIndex: state.currentStepIndex,
        stepId: step.id,
        message: `MCP handler response received${indicatesMissingInput ? ' (may indicate missing input)' : ''}`,
        details: { 
          outputLength: rawOutput.length,
          outputPreview: rawOutput.substring(0, 200),
          hasLLMResponse: !!(mcpData.metadata?.model),
          model: mcpData.metadata?.model,
          usage: mcpData.metadata?.usage,
          indicatesMissingInput,
          requiredVariables: Array.from(requiredVariables),
        },
      });

      // Interpret output (unless it's a tool file reference, which we handle specially)
      let interpretation: { output: InterpretedOutput } | { error: InterpretationError };
      
      if (shouldUseToolOutput && toolFileRef) {
        // For tool executions that return file references, create interpretation directly
        await addExecutionLog(state.runId, {
          level: 'info',
          stepIndex: state.currentStepIndex,
          stepId: step.id,
          message: `Tool execution returned file reference, skipping interpretation`,
        });
        
        interpretation = {
          output: {
            raw: toolFileRef, // Store file reference in raw
            data: null,
            artefactType: 'EXECUTOR_OUTPUT',
            sensitivity: 'MEDIUM',
          },
        };
      } else {
        await addExecutionLog(state.runId, {
          level: 'info',
          stepIndex: state.currentStepIndex,
          stepId: step.id,
          message: `Interpreting output from skill execution`,
        });
        
        interpretation = interpretOutput(rawOutput, skillVersion.metadata);
      }

      if ('error' in interpretation) {
        await addExecutionLog(state.runId, {
          level: 'error',
          stepIndex: state.currentStepIndex,
          stepId: step.id,
          message: `Output interpretation failed`,
          details: { error: interpretation.error.message, errorCode: interpretation.error.code },
        });
        
        await db.runStep.update({
          where: { id: runStep.id },
          data: {
            status: 'FAILED',
            errorMessage: interpretation.error.message,
            completedAt: new Date(),
          },
        });

        return {
          status: 'FAILED' as const,
          steps: [
            ...state.steps,
            {
              stepId: step.id,
              stepIndex: state.currentStepIndex,
              type: 'SKILL',
              status: 'FAILED',
              inputContext: resolvedInputsForStorage, // File references for state
              outputContext: undefined,
              errorMessage: interpretation.error.message,
              completedAt: new Date(),
            },
          ],
        };
      }
      
      await addExecutionLog(state.runId, {
        level: 'success',
        stepIndex: state.currentStepIndex,
        stepId: step.id,
        message: `Output interpreted successfully`,
        details: { 
          artefactType: interpretation.output.artefactType,
          hasData: !!interpretation.output.data,
          hasRaw: !!interpretation.output.raw,
        },
      });

      const { output } = interpretation;

      // Create artefact
      const artefact = await db.runArtefact.create({
        data: {
          stepId: runStep.id,
          runId: state.runId,
          type: output.artefactType,
          content: output.data || { raw: output.raw },
          sensitivity: output.sensitivity,
        },
      });

      // Store MCP metadata if available (for tool outputs, includes fileRef and fileName)
      const outputContextData: Record<string, unknown> = {
        raw: output.raw,
        data: output.data,
        artefactRefs: [`artefact-${artefact.id}`],
      };
      
      // Always include MCP metadata if it exists (contains fileRef, fileName, etc. for tools)
      if (mcpData.metadata && typeof mcpData.metadata === 'object') {
        const mcpMetadata = mcpData.metadata as Record<string, unknown>;
        // Store ALL metadata - it's useful for debugging and contains tool execution info
        outputContextData.metadata = mcpMetadata;
        console.error(`${PREFIX} Storing metadata in outputContext:`, JSON.stringify(mcpMetadata, null, 2));
        
        // If metadata contains a fileRef, ensure it's accessible even if raw was overwritten
        if (mcpMetadata.fileRef && typeof mcpMetadata.fileRef === 'string' && mcpMetadata.fileRef.startsWith('__file__:')) {
          // Store fileRef in data as well for easier access
          if (!outputContextData.data || typeof outputContextData.data !== 'object') {
            outputContextData.data = {};
          }
          (outputContextData.data as Record<string, unknown>).fileRef = mcpMetadata.fileRef;
          console.error(`${PREFIX} Stored fileRef in data for easy access:`, mcpMetadata.fileRef);
        }
      } else {
        console.error(`${PREFIX} No metadata found in MCP response`);
      }
      
      // Also ensure file reference is in raw if it's a tool execution
      if (shouldUseToolOutput && toolFileRef) {
        outputContextData.raw = toolFileRef;
        console.error(`${PREFIX} Overriding raw with file reference:`, toolFileRef);
      }

      // Update step
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'SUCCESS',
          outputContext: outputContextData,
          completedAt: new Date(),
        },
      });

      // Update state
      return {
        currentStepIndex: state.currentStepIndex + 1,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'SUCCESS',
            inputContext: resolvedInputsForStorage, // File references for state
            outputContext: outputContextData, // Includes metadata for tool outputs
            completedAt: new Date(),
          },
        ],
        artefacts: [
          ...state.artefacts,
          {
            id: artefact.id,
            stepId: runStep.id,
            type: output.artefactType,
            content: output.data || { raw: output.raw },
            sensitivity: output.sensitivity,
          },
        ],
        context: {
          ...state.context,
          [`step_${state.currentStepIndex}_output`]: output.data || { raw: output.raw },
        },
      };
    } catch (error) {
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      return {
        status: 'FAILED' as const,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'FAILED',
            inputContext: resolvedInputsForStorage, // File references for state
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        ],
      };
    }
  };
}
