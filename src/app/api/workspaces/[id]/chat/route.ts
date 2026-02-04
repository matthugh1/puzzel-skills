import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { callLLM } from '@/lib/llm';
import { actionsToFunctions } from '@/lib/integrations/function-calling';
import { getDefaultModel } from '@/lib/llm/client';
import type { LLMProvider } from '@/lib/llm/types';
import { toolsRegistry } from '@/lib/tools';
import { mergePromptWithInput, extractVariables } from '@/app/api/mcp/tools';
import { initializeFileStorage, saveFile, FILE_REF_PREFIX, isFileReference, getFileMetadata } from '@/lib/file-storage';
import type { FileAttachment } from '@/lib/llm/types';
import { createIntegrationAdapter } from '@/lib/integrations/registry';
import { decrypt } from '@/lib/encryption';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/workspaces/[id]/chat
 * Conversational AI assistant for workspace with skill/tool execution
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKSPACES_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Initialize file storage
    await initializeFileStorage();

    // Handle multipart/form-data (for file uploads) or JSON
    let body: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      skillId?: string;
      toolId?: string;
      toolArgs?: Record<string, unknown>;
      appId?: string;
      actionId?: string;
      actionParams?: Record<string, unknown>;
    };
    let uploadedFiles: Map<string, { file: File; fieldName: string }> = new Map();

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      // Parse FormData
      const formData = await request.formData();
      
      // Extract JSON data from 'data' field
      const dataField = formData.get('data');
      if (typeof dataField === 'string') {
        try {
          body = JSON.parse(dataField);
        } catch (e) {
          return NextResponse.json(
            { error: 'Invalid JSON in data field' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Missing data field in form data' },
          { status: 400 }
        );
      }

      // Extract files (all fields that are File objects)
      for (const [key, value] of formData.entries()) {
        if (value instanceof File && key !== 'data') {
          uploadedFiles.set(key, { file: value, fieldName: key });
        }
      }
    } else {
      // Standard JSON request
      body = await validateRequestBody(request, validationSchemas.workspaceChat);
    }

    const { messages, skillId, toolId, toolArgs, appId, actionId, actionParams } = body;

    // Load workspace and verify membership
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          where: { userId: user.id },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Check if user is member or owner
    const isOwner = workspace.ownerId === user.id;
    const isMember = workspace.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Determine LLM provider
    let provider: LLMProvider;
    if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
    } else {
      return NextResponse.json(
        { error: 'No LLM provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }
    const model = getDefaultModel(provider);

    // Load workspace context for system prompt
    const workspaceSkills = await db.skill.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'ORG',
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const recentRuns = await db.agentRun.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        goal: true,
        status: true,
        createdAt: true,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // Load user's connected integrations and their actions
    const connectedIntegrations = await db.appIntegration.findMany({
      where: {
        userId: user.id,
        status: 'CONNECTED',
      },
      select: {
        appName: true,
      },
    });

    const availableActions: Array<{ appName: string; actionName: string; description: string; inputSchema: unknown }> = [];
    for (const integration of connectedIntegrations) {
      try {
        const adapter = createIntegrationAdapter(integration.appName as 'gmail' | 'slack' | 'office365');
        const actions = await adapter.getActions();
        availableActions.push(...actions.map(action => ({
          appName: integration.appName,
          actionName: action.name,
          description: action.description,
          inputSchema: action.inputSchema,
        })));
      } catch (error) {
        console.error(`Error loading actions for ${integration.appName}:`, error);
      }
    }
    
    console.log('[Chat] Available actions loaded:', {
      count: availableActions.length,
      actions: availableActions.map(a => `${a.appName}:${a.actionName}`),
    });

    // Build workspace-aware system prompt
    const workspaceContext = `
You are an AI assistant helping users in the "${workspace.name}" workspace.
${workspace.description ? `Workspace description: ${workspace.description}` : ''}

Available workspace skills (${workspaceSkills.length}):
${workspaceSkills.map(s => `- ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n')}

Recent user runs:
${recentRuns.map(r => `- ${r.goal} (${r.status})`).join('\n')}

${availableActions.length > 0 ? `
CRITICAL: YOU HAVE ACCESS TO APP ACTIONS THAT YOU CAN EXECUTE AUTOMATICALLY.

These actions are available as functions you can call directly. When a user asks you to perform an action (like "send an email", "read emails", "create a task", etc.), you MUST call the appropriate function automatically.

WHEN A USER ASKS YOU TO PERFORM AN ACTION:
1. YOU MUST EXECUTE IT AUTOMATICALLY - do NOT give instructions on how to do it manually
2. Call the appropriate function with the parameters extracted from their request
3. The function will be executed automatically
4. Then provide a brief natural language confirmation

DO NOT:
- Tell users to use their email client manually
- Provide instructions on how to send emails
- Say "I can't send emails directly"
- Give step-by-step manual instructions

DO:
- Call functions automatically when users request actions
- Extract parameters intelligently from natural language
- Generate appropriate subject lines for emails
- Execute actions immediately when requested
` : ''}

CRITICAL INSTRUCTIONS:
- When users ask you to send emails, read emails, create tasks, check calendars, etc., you MUST call the appropriate function automatically
- DO NOT tell users to use their email client or provide manual instructions
- DO NOT say "I can't send emails directly" - you CAN and MUST execute actions by calling functions
- Extract parameters from natural language intelligently

FINAL REMINDER: You have DIRECT ACCESS to execute app actions via function calling. When users ask you to send emails, read emails, create tasks, etc., you MUST call the appropriate function automatically. Never say you can't do something - you CAN execute these actions.

Your role: Help users accomplish their goals using available skills, tools, and app actions. Be conversational, helpful, and proactive. When users make requests that can be fulfilled by app actions, execute them automatically - do not provide manual instructions.
`;

    // Execute skill if provided
    if (skillId) {
      const skill = await db.skill.findUnique({
        where: { id: skillId },
        include: {
          versions: {
            where: { status: 'PUBLISHED' },
            orderBy: { version: 'desc' },
            take: 1,
            include: {
              metadata: true,
            },
          },
        },
      });

      if (!skill || skill.versions.length === 0) {
        return NextResponse.json(
          { error: 'Skill not found or not published' },
          { status: 404 }
        );
      }

      const skillVersion = skill.versions[0];
      const lastMessage = messages[messages.length - 1];
      
      // Process uploaded files and add file references to inputs
      const inputs: Record<string, unknown> = {
        userRequest: lastMessage.content,
      };

      // Save uploaded files and add references to inputs
      if (uploadedFiles.size > 0) {
        // Create a temporary run ID for file storage (we'll use a simple timestamp-based ID)
        const tempRunId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        for (const [fieldName, { file }] of uploadedFiles.entries()) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const fileRef = await saveFile(tempRunId, fieldName, buffer, file.name);
            // Add file reference to inputs - use field name or default to 'file'
            inputs[fieldName] = fileRef;
            // Also add to userRequest if it's the main file
            if (fieldName === 'file' || uploadedFiles.size === 1) {
              inputs.userRequest = `${lastMessage.content}\n\n[File attached: ${file.name}]`;
            }
          } catch (error) {
            console.error('Error saving file:', error);
            // Continue without file if save fails
          }
        }
      }
      
      // Check if skill has input contract with required fields
      const inputContract = skillVersion.metadata?.inputContract as {
        type?: string;
        properties?: Record<string, { type?: string; description?: string }>;
        required?: string[];
      } | null | undefined;

      // Extract required fields from input contract
      const requiredFields: string[] = [];
      if (inputContract && typeof inputContract === 'object' && !Array.isArray(inputContract)) {
        if (Array.isArray(inputContract.required)) {
          requiredFields.push(...inputContract.required);
        }
      }

      // Extract variables from prompt template ({{variable}} syntax)
      const promptVariables = extractVariables(skillVersion.content);
      
      // Combine required fields from contract and prompt variables
      const allRequiredFields = Array.from(new Set([...requiredFields, ...promptVariables]));

      // If skill has required inputs, check if they're provided
      if (allRequiredFields.length > 0) {
        // Use LLM to determine if required inputs are present in the user's message
        const inputCheckPrompt = `You are analyzing a user's message to determine if they've provided the required inputs for a skill.

Skill: "${skill.name}"
Skill description: ${skill.description || 'N/A'}

Required inputs:
${allRequiredFields.map(field => {
  const prop = inputContract?.properties?.[field];
  return `- ${field}${prop?.description ? `: ${prop.description}` : ''}`;
}).join('\n')}

User's message: "${lastMessage.content}"

Determine if the user has provided the required input(s) or if they're just asking to use the skill without providing the actual input data.

Respond with ONLY a JSON object in this exact format:
{
  "hasInputs": true or false,
  "missingFields": ["field1", "field2"] if hasInputs is false, otherwise []
}

Be strict: if the user just says "analyze this" or "review the contract" without actually providing the contract content, mark hasInputs as false.`;

        try {
          const inputCheckResponse = await callLLM(
            inputCheckPrompt,
            { provider, model },
            undefined,
            undefined,
            undefined
          );

          // Try to parse JSON response
          const responseText = inputCheckResponse.content.trim();
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.hasInputs === false && Array.isArray(parsed.missingFields)) {
              const missingFields = parsed.missingFields as string[];

              // Generate helpful prompt for missing inputs
              const fieldDescriptions = missingFields.map(field => {
                const prop = inputContract?.properties?.[field];
                return prop?.description || field;
              }).join(', ');

              const promptForMissingInputs = `You are helping a user use the "${skill.name}" skill.

The skill requires the following input(s) that are missing: ${fieldDescriptions}

The user's message was: "${lastMessage.content}"

Generate a helpful, friendly response that:
1. Acknowledges what the user wants to do
2. Clearly explains what input is needed (${fieldDescriptions})
3. Offers two options:
   - Upload a file (if applicable - mention file types like PDF, DOCX, TXT, etc.)
   - Paste the content directly in the chat

Be conversational and helpful. Don't be overly technical. Make it clear that once they provide the input, you can proceed with the skill execution.

Example format:
"I'd be happy to help you [skill purpose]. To get started, I need [what's needed]. You can either:
- Upload a file (PDF, Word doc, text file, etc.)
- Paste the content directly here

Once you provide that, I'll analyze it right away!"`;

              const llmResponse = await callLLM(
                promptForMissingInputs,
                { provider, model, systemPrompt: workspaceContext },
                undefined,
                undefined,
                undefined
              );

              return NextResponse.json({
                response: {
                  type: 'message',
                  content: llmResponse.content,
                  skillId,
                  needsInput: true,
                  missingFields,
                },
              });
            }
          }
        } catch (error) {
          // If LLM check fails, fall through to normal execution
          console.error('Error checking for missing inputs:', error);
        }
      }


      // Extract file attachments from inputs (similar to MCP handler)
      const fileAttachments: FileAttachment[] = [];
      const inputsWithoutFiles: Record<string, unknown> = {};
      
      for (const [key, value] of Object.entries(inputs)) {
        if (isFileReference(value)) {
          try {
            const metadata = await getFileMetadata(value);
            fileAttachments.push({
              ref: value,
              metadata,
            });
            console.log(`[Chat] Detected file attachment: ${metadata.name} (${metadata.mimeType})`);
          } catch (error) {
            console.error(`[Chat] Error processing file attachment ${key}:`, error);
            // Continue without this file attachment
          }
        } else {
          // Keep non-file inputs for prompt merging
          inputsWithoutFiles[key] = value;
        }
      }

      // Merge prompt with inputs (excluding file references - they're handled separately)
      const prompt = mergePromptWithInput(skillVersion.content, inputsWithoutFiles);

      // Execute skill with LLM, passing file attachments
      const llmResponse = await callLLM(
        prompt,
        { provider, model, files: fileAttachments },
        undefined,
        undefined,
        undefined
      );

      // Log audit event
      await audit.skillExecuted(skillId, user.id, {
        workspaceId: id,
        inputs,
      }, request);

      // Check if tools are also selected (for showing tool buttons after skill execution)
      const selectedToolsInfo: Array<{ id: string; name: string; description: string }> = [];
      if (toolId && !toolArgs) {
        const tool = toolsRegistry.get(toolId);
        if (tool) {
          selectedToolsInfo.push({
            id: tool.id,
            name: tool.name,
            description: tool.description,
          });
        }
      }

      return NextResponse.json({
        response: {
          type: 'skill_result',
          content: llmResponse.content,
          skillId,
          result: {
            success: true,
            output: llmResponse.content,
          },
          canEscalate: true,
          selectedTools: selectedToolsInfo.length > 0 ? selectedToolsInfo : undefined,
        },
      });
    }

    // Execute tool if provided
    if (toolId && toolArgs) {
      const tool = toolsRegistry.get(toolId);
      if (!tool) {
        return NextResponse.json(
          { error: 'Tool not found' },
          { status: 404 }
        );
      }

      // Process uploaded files for tool arguments (if any)
      const processedToolArgs = { ...toolArgs };
      if (uploadedFiles.size > 0) {
        // Create a temporary run ID for file storage
        const tempRunId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        for (const [fieldName, { file }] of uploadedFiles.entries()) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const fileRef = await saveFile(tempRunId, fieldName, buffer, file.name);
            // Add file reference to tool args
            processedToolArgs[fieldName] = fileRef;
          } catch (error) {
            console.error('Error saving file for tool:', error);
            // Continue without file if save fails
          }
        }
      }

      // Smart argument mapping: if tool expects "content" but we got "input", map it
      // Also check if we need to extract content from conversation history
      const toolSchema = tool.inputSchema;
      const requiredFields = (toolSchema.required || []) as string[];
      const schemaProperties = (toolSchema.properties || {}) as Record<string, { type?: string; description?: string }>;
      
      // If tool expects "content" but we have "input", map it
      if (requiredFields.includes('content') && processedToolArgs.input && !processedToolArgs.content) {
        processedToolArgs.content = processedToolArgs.input;
        delete processedToolArgs.input;
      }
      
      // If content is still missing, try to extract from conversation
      if (requiredFields.includes('content') && !processedToolArgs.content) {
        // Get the last user message or assistant message with content
        const lastMessage = messages[messages.length - 1];
        const secondLastMessage = messages[messages.length - 2];
        
        // Prefer assistant's response if available (it might have formatted content)
        if (lastMessage.role === 'assistant' && lastMessage.content) {
          processedToolArgs.content = lastMessage.content;
        } else if (secondLastMessage && secondLastMessage.role === 'assistant' && secondLastMessage.content) {
          processedToolArgs.content = secondLastMessage.content;
        } else if (lastMessage.content) {
          processedToolArgs.content = lastMessage.content;
        } else {
          // Fallback: combine all user messages
          const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
          processedToolArgs.content = userMessages.join('\n\n');
        }
      }

      // Execute tool
      const toolResult = await toolsRegistry.execute(
        toolId,
        processedToolArgs,
        {
          userId: user.id,
          runId: `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`, // Generate temp runId for file storage
        }
      );

      // Log audit event
      await audit.toolExecuted(toolId, user.id, {
        workspaceId: id,
        arguments: toolArgs,
        success: toolResult.success,
      }, request);

      return NextResponse.json({
        response: {
          type: 'tool_result',
          content: toolResult.success
            ? `Tool executed successfully:\n\n${toolResult.output}`
            : `Tool execution failed: ${toolResult.error || 'Unknown error'}`,
          toolId,
          result: toolResult,
          canEscalate: toolResult.success,
        },
      });
    }

    // Execute app action if provided
    if (appId && actionId) {
      // Load user's integration
      const integration = await db.appIntegration.findUnique({
        where: {
          userId_appName: {
            userId: user.id,
            appName: appId,
          },
        },
      });

      if (!integration || integration.status !== 'CONNECTED') {
        return NextResponse.json(
          { error: `Integration ${appId} not connected` },
          { status: 400 }
        );
      }

      // Decrypt credentials
      const credentialsData = (integration.credentials as { encrypted?: string })?.encrypted;
      if (!credentialsData) {
        return NextResponse.json(
          { error: 'Integration credentials not found' },
          { status: 500 }
        );
      }

      const decrypted = decrypt(credentialsData);
      const credentials = JSON.parse(decrypted);

      // Create adapter and connect
      const adapter = createIntegrationAdapter(appId as 'gmail' | 'slack' | 'office365');
      await adapter.connect(credentials);

      try {
        // Parse action params from user input or provided params
        let params: Record<string, unknown> = {};
        
        // Get the last user message content
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const userInput = lastMessage?.content || '';
        
        // If actionParams was provided, check if it's just a wrapper
        if (actionParams && Object.keys(actionParams).length === 1 && actionParams.userInput) {
          // It's just a wrapper, parse the actual userInput
          try {
            const parsed = JSON.parse(actionParams.userInput as string);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              params = parsed;
            } else {
              // Not a valid object, try parsing the message content instead
              if (userInput) {
                try {
                  const parsedFromMessage = JSON.parse(userInput);
                  if (typeof parsedFromMessage === 'object' && parsedFromMessage !== null && !Array.isArray(parsedFromMessage)) {
                    params = parsedFromMessage;
                  } else {
                    params = { userInput };
                  }
                } catch {
                  params = { userInput };
                }
              } else {
                params = actionParams;
              }
            }
          } catch {
            // Not JSON, try parsing the message content directly
            if (userInput) {
              try {
                const parsed = JSON.parse(userInput);
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                  params = parsed;
                } else {
                  params = { userInput };
                }
              } catch {
                params = { userInput };
              }
            } else {
              params = actionParams;
            }
          }
        } else if (actionParams && Object.keys(actionParams).length > 0) {
          // actionParams has actual structured data, use it directly
          params = { ...actionParams };
        } else if (userInput) {
          // No actionParams, try parsing the message content
          try {
            const parsed = JSON.parse(userInput);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              params = parsed;
            } else {
              params = { userInput };
            }
          } catch {
            // Not JSON, treat as simple input
            params = { userInput };
          }
        }

        // Execute action
        const actionOutput = await adapter.executeAction(actionId, params);

        // Disconnect adapter
        await adapter.disconnect();

        // Log audit event
        await audit.workflowUpdated(integration.id, user.id, {
          appActionExecuted: {
            appName: appId,
            actionName: actionId,
            workspaceId: id,
          },
        }, request);

        return NextResponse.json({
          response: {
            type: 'app_action_result',
            content: `Action "${actionId}" executed successfully.`,
            appId,
            actionId,
            result: actionOutput,
            canEscalate: true,
          },
        });
      } catch (actionError) {
        await adapter.disconnect();
        const errorMessage = actionError instanceof Error ? actionError.message : 'Unknown error';
        return NextResponse.json(
          { error: `Failed to execute action: ${errorMessage}` },
          { status: 500 }
        );
      }
    }

    // Conversational response with workspace context
    const conversationHistory = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Process uploaded files for conversational responses (extract text from PDFs, etc.)
    const fileAttachments: FileAttachment[] = [];
    if (uploadedFiles.size > 0) {
      // Create a temporary run ID for file storage
      const tempRunId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      for (const [fieldName, { file }] of uploadedFiles.entries()) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          console.log(`[Chat] Saving file: ${file.name} (${file.size} bytes, type: ${file.type})`);
          
          const fileRef = await saveFile(tempRunId, fieldName, buffer, file.name);
          
          // Get file metadata and add to attachments
          const metadata = await getFileMetadata(fileRef);
          
          console.log(`[Chat] File metadata retrieved:`, {
            name: metadata.name,
            mimeType: metadata.mimeType,
            isImage: metadata.isImage,
            isText: metadata.isText,
            fileRef,
          });
          
          fileAttachments.push({
            ref: fileRef,
            metadata,
          });
          console.log(`[Chat] Processed file attachment for conversational response: ${metadata.name} (${metadata.mimeType})`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          console.error(`[Chat] Error processing file attachment ${fieldName}:`, {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            error: errorMsg,
            stack: errorStack,
          });
          // Continue without this file attachment - the LLM will be informed of the error
        }
      }
      
      console.log(`[Chat] Total file attachments prepared: ${fileAttachments.length}`);
    }

    // Build system prompt with tool information if tools are selected
    let systemPrompt = `${workspaceContext}\n\nBe helpful, conversational, and reference workspace resources when relevant.`;
    
    // If tools are selected but not executed, inform LLM about available tools
    const selectedToolsInfo: Array<{ id: string; name: string; description: string }> = [];
    console.log('[Chat] Checking for selected tools:', { toolId, hasToolArgs: !!toolArgs, skillId });
    
    if (toolId && !toolArgs) {
      // Tool is selected but not executed - get tool info
      console.log('[Chat] Tool selected but not executed, loading tool info:', toolId);
      const tool = toolsRegistry.get(toolId);
      console.log('[Chat] Tool found:', tool ? { id: tool.id, name: tool.name } : 'not found');
      
      if (tool) {
        selectedToolsInfo.push({
          id: tool.id,
          name: tool.name,
          description: tool.description,
        });
        systemPrompt += `\n\nCRITICAL: The user has selected the tool "${tool.name}" (${tool.description}). 

You MUST start your response by acknowledging this tool selection. Your response should follow this structure:

1. FIRST SENTENCE: "I notice you have the "${tool.name}" tool selected."
2. SECOND SENTENCE: Briefly explain what the tool does: "${tool.description}"
3. THIRD SENTENCE: Ask if they want to run it: "Would you like me to run it now?"

Then continue with your normal helpful response.

Example:
"I notice you have the "${tool.name}" tool selected. ${tool.description} Would you like me to run it now? [Then continue with your response to their message]"

The tool will be executed when the user clicks a button - your role is to acknowledge it and suggest running it.`;
        console.log('[Chat] Updated system prompt with tool information');
      }
    }

    // Convert app actions to function calling format
    const functions = availableActions.flatMap(action => {
      try {
        return actionsToFunctions([{
          name: action.actionName,
          description: action.description,
          inputSchema: action.inputSchema,
        }], action.appName);
      } catch (error) {
        console.error(`[Chat] Error converting action ${action.appName}:${action.actionName} to function:`, error);
        return [];
      }
    });

    console.log(`[Chat] Converted ${availableActions.length} actions to ${functions.length} functions`);

    // Build conversation prompt - include file attachments if present
    const conversationPrompt = conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    console.log(`[Chat] Calling LLM with ${fileAttachments.length} file attachment(s) and ${functions.length} function(s)`);
    if (fileAttachments.length > 0) {
      fileAttachments.forEach((fa, idx) => {
        console.log(`[Chat] File ${idx + 1}: ${fa.metadata.name} (${fa.metadata.mimeType}, isImage: ${fa.metadata.isImage}, isText: ${fa.metadata.isText})`);
      });
    }

    let llmResponse;
    try {
      llmResponse = await callLLM(
        conversationPrompt,
        {
          provider,
          model,
          systemPrompt,
          files: fileAttachments.length > 0 ? fileAttachments : undefined,
          functions: functions.length > 0 ? functions : undefined,
          functionCall: functions.length > 0 ? 'auto' : undefined,
        },
        undefined,
        undefined,
        undefined
      );
    } catch (llmError) {
      const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
      console.error(`[Chat] LLM call failed:`, llmError);
      
      // If it's a file extraction error, return a user-friendly error
      if (errorMsg.includes('Failed to extract text') || errorMsg.includes('extraction failed')) {
        return NextResponse.json({
          response: {
            type: 'message',
            content: `I'm sorry, but I encountered an error while trying to extract text from the uploaded file. ${errorMsg}\n\nPlease try:\n- Ensuring the file is not password-protected\n- Checking that the file is not corrupted\n- Trying a different file format if possible`,
          },
        });
      }
      
      // Re-throw other errors
      throw llmError;
    }

    // Check if LLM wants to call a function (function calling)
    let actionToExecute: { appName: string; actionName: string; params: Record<string, unknown> } | null = null;
    let responseText = llmResponse.content;
    
    // Handle function calling response
    if (llmResponse.functionCall) {
      const functionCallData = llmResponse.functionCall;
      const functionName = functionCallData.name;
      const functionArgs = functionCallData.arguments;
      console.log(`[Chat] Function call detected: ${functionName} with args:`, functionArgs);
      
      // Parse function name: format is "appName_actionName" (underscore separator for OpenAI compatibility)
      // Split on first underscore to separate app name from action name
      const firstUnderscoreIndex = functionName.indexOf('_');
      if (firstUnderscoreIndex === -1) {
        console.error(`[Chat] Invalid function name format: ${functionName}`);
      } else {
        const appName = functionName.substring(0, firstUnderscoreIndex);
        const actionName = functionName.substring(firstUnderscoreIndex + 1);
        
        if (appName && actionName) {
          try {
            const params = typeof functionArgs === 'string' ? JSON.parse(functionArgs) : functionArgs;
            actionToExecute = {
              appName,
              actionName,
              params: params || {},
            };
            console.log(`[Chat] Parsed function call:`, actionToExecute);
          } catch (error) {
            console.error(`[Chat] Error parsing function arguments:`, error);
          }
        }
      }
    }
    
    console.log('[Chat] Action execution check:', {
      foundAction: !!actionToExecute,
      action: actionToExecute,
      responseLength: llmResponse.content.length,
      availableActionsCount: availableActions.length,
      functionCallDetected: !!llmResponse.functionCall,
    });

    // If LLM wants to execute an action, do it
    if (actionToExecute && actionToExecute.appName && actionToExecute.actionName) {
      // Load user's integration
      const integration = await db.appIntegration.findUnique({
        where: {
          userId_appName: {
            userId: user.id,
            appName: actionToExecute.appName,
          },
        },
      });

      if (integration && integration.status === 'CONNECTED') {
        try {
          // Decrypt credentials
          // Credentials structure: { encrypted: string } or { encrypted?: string, oauthState?: string }
          const credentialsObj = integration.credentials as { encrypted?: string; oauthState?: string } | null;
          const credentialsData = credentialsObj?.encrypted;
          if (!credentialsData) {
            console.error(`[Chat] No encrypted credentials found for integration ${integration.id}`);
            return NextResponse.json({
              response: {
                type: 'message',
                content: `I tried to execute ${actionToExecute.actionName}, but the integration credentials are missing. Please reconnect your ${actionToExecute.appName} integration.`,
              },
            });
          }
          
          let decrypted: string;
          try {
            decrypted = decrypt(credentialsData);
            if (!decrypted || decrypted.trim().length === 0) {
              throw new Error('Decrypted credentials are empty');
            }
          } catch (decryptError) {
            console.error(`[Chat] Decryption error:`, decryptError);
            return NextResponse.json({
              response: {
                type: 'message',
                content: `I tried to execute ${actionToExecute.actionName}, but failed to decrypt the integration credentials. Please reconnect your ${actionToExecute.appName} integration.`,
              },
            });
          }
          
          let credentials: Record<string, unknown>;
          try {
            credentials = JSON.parse(decrypted);
          } catch (parseError) {
            console.error(`[Chat] JSON parse error. Decrypted length: ${decrypted.length}, preview: ${decrypted.substring(0, 100)}`, parseError);
            return NextResponse.json({
              response: {
                type: 'message',
                content: `I tried to execute ${actionToExecute.actionName}, but the integration credentials are invalid. Please reconnect your ${actionToExecute.appName} integration.`,
              },
            });
          }

          // Create adapter and connect
          const adapter = createIntegrationAdapter(actionToExecute.appName as 'gmail' | 'slack' | 'office365');
          await adapter.connect(credentials);

          try {
            // Execute action
            const actionOutput = await adapter.executeAction(actionToExecute.actionName, actionToExecute.params || {});

            // Disconnect adapter
            await adapter.disconnect();

            // Log audit event
            await audit.workflowUpdated(integration.id, user.id, {
              appActionExecuted: {
                appName: actionToExecute.appName,
                actionName: actionToExecute.actionName,
                workspaceId: id,
              },
            }, request);

            // For actions that return data (like email searches), call LLM again to analyze and answer
            // For actions that just perform operations (like send_email), return success message
            const isDataAction = actionToExecute.actionName === 'read_emails' || 
                                actionToExecute.actionName === 'search_emails' || 
                                actionToExecute.actionName === 'read_emails_from_folder' ||
                                actionToExecute.actionName === 'get_email' ||
                                actionToExecute.actionName === 'get_calendar_events' ||
                                actionToExecute.actionName === 'list_todo_tasks' ||
                                actionToExecute.actionName === 'read_channel_messages' ||
                                actionToExecute.actionName === 'read_chat_messages' ||
                                actionToExecute.actionName === 'list_teams' ||
                                actionToExecute.actionName === 'list_channels' ||
                                actionToExecute.actionName === 'list_chats';

            if (isDataAction) {
              // Get the last user message
              const lastUserMsg = messages.filter(m => m.role === 'user').pop();
              const userQuestion = lastUserMsg?.content || messages[messages.length - 1]?.content || 'unknown';
              
              // Call LLM again with the function results to generate a natural language answer
              const functionResultsPrompt = `The user asked: "${userQuestion}"

I executed the ${actionToExecute.actionName} action and got these results:

${JSON.stringify(actionOutput, null, 2)}

Please analyze these results and provide a natural, conversational answer to the user's question. Be specific and helpful. If the results are empty or don't contain relevant information, let the user know.`;

              const followUpResponse = await callLLM(
                functionResultsPrompt,
                {
                  provider,
                  model,
                  systemPrompt: `${workspaceContext}\n\nYou are helping the user understand the results of actions that were executed. Provide clear, helpful answers based on the data.`,
                },
                undefined,
                undefined,
                undefined
              );

              return NextResponse.json({
                response: {
                  type: 'app_action_result',
                  content: followUpResponse.content,
                  appId: actionToExecute.appName,
                  actionId: actionToExecute.actionName,
                  result: actionOutput,
                  canEscalate: true,
                },
              });
            } else {
              // For action-based operations (send_email, create, etc.), return success message
              let successMessage = '';
              if (actionToExecute.actionName === 'send_email') {
                successMessage = `✅ Email sent successfully!`;
              } else if (actionToExecute.actionName === 'create_calendar_event') {
                // Provide more details for calendar events
                const eventResult = actionOutput as { id?: string; subject?: string; start?: { dateTime: string; timeZone: string }; end?: { dateTime: string; timeZone: string } };
                if (eventResult.id) {
                  const startTime = eventResult.start?.dateTime ? new Date(eventResult.start.dateTime).toLocaleString() : 'scheduled time';
                  successMessage = `✅ Calendar event "${eventResult.subject || 'Meeting'}" created successfully! Scheduled for ${startTime}.`;
                } else {
                  successMessage = `✅ Calendar event created successfully!`;
                }
              } else if (actionToExecute.actionName.startsWith('create_')) {
                successMessage = `✅ Created successfully!`;
              } else {
                successMessage = `✅ Action "${actionToExecute.actionName}" executed successfully.`;
              }
              
              return NextResponse.json({
                response: {
                  type: 'app_action_result',
                  content: responseText ? `${responseText}\n\n${successMessage}` : successMessage,
                  appId: actionToExecute.appName,
                  actionId: actionToExecute.actionName,
                  result: actionOutput,
                  canEscalate: true,
                },
              });
            }
          } catch (actionError) {
            await adapter.disconnect();
            const errorMessage = actionError instanceof Error ? actionError.message : 'Unknown error';
            return NextResponse.json({
              response: {
                type: 'message',
                content: `I tried to execute ${actionToExecute.actionName}, but encountered an error: ${errorMessage}`,
              },
            });
          }
        } catch (credError) {
          console.error('Error executing action:', credError);
          const errorMessage = credError instanceof Error ? credError.message : 'Unknown error';
          return NextResponse.json({
            response: {
              type: 'message',
              content: `I tried to execute ${actionToExecute.actionName}, but encountered an error: ${errorMessage}`,
            },
          });
        }
      }
    }

    console.log('[Chat] Returning conversational response:', {
      hasSelectedTools: selectedToolsInfo.length > 0,
      selectedTools: selectedToolsInfo,
    });

    return NextResponse.json({
      response: {
        type: 'message',
        content: responseText || llmResponse.content,
        selectedTools: selectedToolsInfo.length > 0 ? selectedToolsInfo : undefined,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Workspace chat validation error:', {
        errors: error.errors,
        messageCount: messages?.length,
        skillId,
        toolId,
      });
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: errorMessage, // Send as string, not array
          errors: error.errors, // Keep full errors array for debugging if needed
        },
        { status: 400 }
      );
    }

    // Extract error message properly - handle various error formats
    let errorMessage: string;
    let errorStack: string | undefined;
    let errorName: string;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      errorName = error.name;
    } else if (typeof error === 'object' && error !== null) {
      // Handle error objects with message property
      const errorObj = error as { message?: string; statusCode?: number; error?: string; details?: unknown };
      errorMessage = errorObj.message || errorObj.error || JSON.stringify(errorObj);
      errorName = 'Error';
      
      // If it's an API authentication error, provide helpful message
      if (errorObj.statusCode === 401) {
        if (errorMessage.includes('API key') || errorMessage.includes('access to the project')) {
          errorMessage = `Authentication failed: ${errorMessage}. Please check your OpenAI or Anthropic API key configuration.`;
        }
      }
    } else {
      errorMessage = String(error);
      errorName = 'UnknownError';
    }
    
    console.error('[Chat] Workspace chat error:', {
      error: errorMessage,
      name: errorName,
      stack: errorStack,
      errorObj: error,
      errorType: error instanceof Error ? 'Error instance' : typeof error,
    });
    
    // In development, include full error details
    // Make sure details is a string, not an object
    const errorResponse: { error: string; details?: string; stack?: string; name?: string } = {
      error: 'Failed to process chat message',
      details: errorMessage, // Always include details as string
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = errorStack;
      errorResponse.name = errorName;
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
