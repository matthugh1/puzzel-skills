/**
 * Anthropic (Claude) LLM Integration
 * Handles calls to Anthropic API with comprehensive logging
 */

import Anthropic from '@anthropic-ai/sdk';
import { addExecutionLog } from '../runtime/execution-logger';
import type { LLMConfig, LLMResponse, LLMError, FileAttachment, LLMFunction } from './types';

// Re-export types for backward compatibility
export type { LLMConfig, LLMResponse, LLMError, FileAttachment } from './types';

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey,
    });
  }
  return anthropicClient;
}

/**
 * Get the maximum context window tokens for a given Anthropic model
 * Based on Anthropic's model specifications:
 * - Claude Sonnet 4: 1M tokens (1,000,000) in public beta
 * - Claude Enterprise with Sonnet 4: 500K tokens (500,000)
 * - Most other Claude models: 200K tokens (200,000)
 */
function getMaxContextTokens(model: string): number {
  // Claude Sonnet 4 models support 1M tokens
  // Check for various Sonnet 4 naming patterns
  const normalizedModel = model.toLowerCase();
  if (
    normalizedModel.includes('sonnet-4-5') ||
    normalizedModel.includes('sonnet-4') ||
    normalizedModel.startsWith('claude-sonnet-4')
  ) {
    return 1_000_000; // 1M tokens
  }
  
  // Claude Opus 4 models typically have 200K, but check for enterprise variants
  // For now, default to 200K for Opus 4 unless explicitly configured
  
  // Default to 200K tokens for all other models
  return 200_000;
}

/**
 * Call Anthropic API with a prompt and optional file attachments
 */
export async function callAnthropic(
  prompt: string,
  config: LLMConfig = {},
  runId?: string,
  stepIndex?: number,
  stepId?: string
): Promise<LLMResponse> {
  const client = getAnthropicClient();
  const model = config.model || process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 2000;
  const files = config.files || [];
  const functions = config.functions || [];
  const functionCall = config.functionCall || (functions.length > 0 ? 'auto' : undefined);
  const systemPrompt = config.systemPrompt;

  const startTime = Date.now();

  // Build message content array (text + file attachments)
  // Anthropic supports base64-encoded files directly in content array
  const messageContentParts: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: string; media_type: string; data: string } }> = [
    { type: 'text', text: prompt },
  ];

  // Add file attachments
  for (const fileAttachment of files) {
    const { metadata } = fileAttachment;
    
    if (metadata.isImage) {
      // Images are supported natively as base64-encoded content
      try {
        // Dynamic import to avoid bundling file-storage in client code
        const { loadFileBuffer } = await import('../file-storage');
        const buffer = await loadFileBuffer(fileAttachment.ref);
        const base64 = buffer.toString('base64');
        
        messageContentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: metadata.mimeType,
            data: base64,
          },
        });
        
        console.error(`[Anthropic] Image attached: ${metadata.name} (${metadata.mimeType})`);
      } catch (error) {
        console.error(`[Anthropic] Error loading image file ${fileAttachment.ref}:`, error);
        // Continue without this file attachment
      }
    } else {
      // For documents (PDFs, .docx, etc.), extract text locally and include in prompt
      // This matches OpenAI's approach - extract text server-side before sending
      try {
        // Dynamic import to avoid bundling file-storage in client code
        const { loadFile } = await import('../file-storage');
        
        console.error(`[Anthropic] Extracting text locally from: ${metadata.name} (${metadata.mimeType})`);
        
        // Use loadFile which handles PDF extraction with pdf-parse
        // For .docx, it will fail gracefully if mammoth isn't installed
        let textContent: string;
        
        if (metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            metadata.name.toLowerCase().endsWith('.docx')) {
          // For .docx files, try mammoth first
          try {
            const mammoth = await import('mammoth');
            const { loadFileBuffer } = await import('../file-storage');
            const buffer = await loadFileBuffer(fileAttachment.ref);
            const result = await mammoth.extractRawText({ buffer });
            textContent = result.value || '';
            
            if (!textContent || textContent.trim().length === 0) {
              throw new Error('Extracted text is empty');
            }
            
            console.error(`[Anthropic] Extracted text from .docx using mammoth: ${textContent.length} chars`);
          } catch (docxError) {
            const errorMsg = docxError instanceof Error ? docxError.message : String(docxError);
            
            // If mammoth isn't installed, provide helpful error
            if (errorMsg.includes('Cannot find module') || errorMsg.includes('mammoth') || errorMsg.includes('MODULE_NOT_FOUND')) {
              const installError = `.docx file extraction requires 'mammoth' package. Install with: npm install mammoth`;
              
              if (runId) {
                await addExecutionLog(runId, {
                  level: 'error',
                  stepIndex,
                  stepId,
                  message: `Missing dependency for .docx extraction`,
                  details: {
                    fileName: metadata.name,
                    error: installError,
                    solution: 'Install mammoth package: npm install mammoth',
                  },
                });
              }
              
              throw new Error(installError);
            }
            throw docxError;
          }
        } else {
          // For PDFs and other files, use loadFile which handles PDF extraction
          try {
            textContent = await loadFile(fileAttachment.ref);
            
            // Verify we got actual content, not an error message
            if (!textContent || textContent.trim().length < 10) {
              throw new Error(`Extracted text is too short (${textContent?.length || 0} chars) - extraction may have failed`);
            }
            
            // Check if it's an error message (common error messages from loadFile)
            if (textContent.includes('[PDF file -') || textContent.includes('unable to extract')) {
              throw new Error(`PDF extraction returned error message instead of content: ${textContent.substring(0, 100)}`);
            }
          } catch (loadError) {
            const errorMsg = loadError instanceof Error ? loadError.message : String(loadError);
            console.error(`[Anthropic] Error loading file content:`, loadError);
            
            // Log to execution logs
            if (runId) {
              await addExecutionLog(runId, {
                level: 'error',
                stepIndex,
                stepId,
                message: `File text extraction failed: ${metadata.name}`,
                details: {
                  fileName: metadata.name,
                  mimeType: metadata.mimeType,
                  error: errorMsg,
                },
              });
            }
            
            throw loadError; // Re-throw to be caught by outer catch
          }
        }
        
        // Add file content to the prompt
        messageContentParts.push({
          type: 'text',
          text: `\n\n[File: ${metadata.name}]\n${textContent}`,
        });
        
        console.error(`[Anthropic] File content included in prompt: ${metadata.name} (${textContent.length} chars)`);
        
        // Log success
        if (runId) {
          await addExecutionLog(runId, {
            level: 'info',
            stepIndex,
            stepId,
            message: `File content extracted: ${metadata.name}`,
            details: {
              fileName: metadata.name,
              mimeType: metadata.mimeType,
              contentLength: textContent.length,
              method: 'Local extraction',
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorDetails = error instanceof Error ? { stack: error.stack, name: error.name } : {};
        
        console.error(`[Anthropic] Error extracting text from file ${fileAttachment.ref}:`, error);
        console.error(`[Anthropic] Error details:`, errorDetails);
        console.error(`[Anthropic] File metadata:`, {
          name: metadata.name,
          mimeType: metadata.mimeType,
          isImage: metadata.isImage,
          isText: metadata.isText,
          ref: fileAttachment.ref,
        });
        
        // Log error to execution logs for debugging
        if (runId) {
          await addExecutionLog(runId, {
            level: 'error',
            stepIndex,
            stepId,
            message: `File text extraction failed: ${metadata.name}`,
            details: {
              fileName: metadata.name,
              mimeType: metadata.mimeType,
              fileRef: fileAttachment.ref,
              error: errorMessage,
              errorDetails,
            },
          });
        }
        
        // Instead of silently including error in prompt, throw the error so it can be handled properly
        // This allows the API route to return a proper error response to the user
        throw new Error(`Failed to extract text from ${metadata.name} (${metadata.mimeType}): ${errorMessage}`);
      }
    }
  }

  // Count tokens before sending to validate against model limits
  let estimatedTokens: number | undefined;
  try {
    // Use Anthropic SDK's countTokens method to estimate token count
    const tokenCountResponse = await client.messages.countTokens({
      model,
      messages: [
        {
          role: 'user',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: messageContentParts as any,
        },
      ] as any,
    });
    // Extract input_tokens from the response object
    estimatedTokens = typeof tokenCountResponse === 'object' && 'input_tokens' in tokenCountResponse
      ? tokenCountResponse.input_tokens
      : typeof tokenCountResponse === 'number'
      ? tokenCountResponse
      : undefined;
    
    // Check against model's maximum context window (varies by model)
    const MAX_CONTEXT_TOKENS = getMaxContextTokens(model);
    console.error(`[Anthropic] Token validation: model=${model}, estimatedTokens=${estimatedTokens}, maxContextTokens=${MAX_CONTEXT_TOKENS}`);
    
    if (estimatedTokens !== undefined && estimatedTokens > MAX_CONTEXT_TOKENS) {
      const maxTokensFormatted = MAX_CONTEXT_TOKENS >= 1_000_000 
        ? `${MAX_CONTEXT_TOKENS / 1_000_000}M` 
        : MAX_CONTEXT_TOKENS >= 1_000 
        ? `${MAX_CONTEXT_TOKENS / 1_000}K` 
        : MAX_CONTEXT_TOKENS.toString();
      
      const errorMessage = `Prompt is too long: ${estimatedTokens.toLocaleString()} tokens exceeds maximum of ${maxTokensFormatted} tokens (${MAX_CONTEXT_TOKENS.toLocaleString()}) for model ${model}. Please reduce the prompt size or split it into smaller chunks.`;
      
      if (runId) {
        await addExecutionLog(runId, {
          level: 'error',
          stepIndex,
          stepId,
          message: `Anthropic API request rejected: prompt too long`,
          details: {
            provider: 'Anthropic',
            model,
            estimatedTokens,
            maxContextTokens: MAX_CONTEXT_TOKENS,
            promptLength: prompt.length,
            fileCount: files.length,
            error: errorMessage,
          },
        });
      }
      
      const llmError: LLMError = {
        message: errorMessage,
        statusCode: 400,
      };
      
      throw llmError;
    }
  } catch (tokenCountError) {
    // If token counting fails, log warning but continue (don't block the request)
    console.error(`[Anthropic] Failed to count tokens:`, tokenCountError);
    // Continue without token validation - let the API handle it
  }

  // Log LLM request
  if (runId) {
    await addExecutionLog(runId, {
      level: 'info',
      stepIndex,
      stepId,
      message: `Sending request to Anthropic (${model})`,
      details: {
        provider: 'Anthropic',
        model,
        temperature,
        maxTokens,
        estimatedTokens,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200),
        fileCount: files.length,
        imageCount: files.filter(f => f.metadata.isImage).length,
      },
    });
  }

  try {
    console.error(`[Anthropic] Starting API call for run ${runId}, step ${stepIndex} with ${files.length} file(s) and ${functions.length} function(s), estimated tokens: ${estimatedTokens ?? 'unknown'}`);
    
    // Convert functions to Anthropic tools format
    const tools = functions.length > 0 ? functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters,
    })) : undefined;
    
    // Prepare request options
    const requestOptions: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: messageContentParts as any,
        },
      ] as any,
    };
    
    // Add system prompt if provided (Anthropic uses top-level system parameter)
    if (systemPrompt) {
      requestOptions.system = systemPrompt;
    }
    
    // Add tools if provided
    if (tools && tools.length > 0) {
      requestOptions.tools = tools;
    }
    
    // Add beta header for 1M token context if using Sonnet 4 models
    const MAX_CONTEXT_TOKENS = getMaxContextTokens(model);
    if (MAX_CONTEXT_TOKENS >= 1_000_000) {
      // Note: The 1M token context may require beta access or specific API tier
      // For now, we'll let the API handle it - if beta header is needed, it will be added here
      // The SDK may handle this automatically, but if not, we may need to add:
      // requestOptions.beta = ['context-window-1m-2025-01-01']; // Example beta feature name
      console.error(`[Anthropic] Using model with 1M token support: ${model}`);
    }
    
    // Anthropic SDK accepts content as string or array of content blocks
    // Type assertion needed due to SDK type definition limitations
    const response = await client.messages.create(requestOptions);

    const latency = Date.now() - startTime;
    
    // Check for tool use (function calling) in response
    let functionCallResponse: LLMResponse['functionCall'] | undefined;
    const toolUseBlock = response.content.find((block: any) => block.type === 'tool_use');
    if (toolUseBlock) {
      functionCallResponse = {
        name: toolUseBlock.name,
        arguments: JSON.stringify(toolUseBlock.input || {}),
      };
      console.error(`[Anthropic] Function call detected: ${functionCallResponse.name} for run ${runId}`);
    }
    
    const content = response.content.find((block: any) => block.type === 'text')?.text || '';
    const usage = response.usage
      ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        }
      : undefined;

    // Log LLM response
    if (runId) {
      console.error(`[Anthropic] Logging response for run ${runId}, step ${stepIndex}`);
      try {
        await addExecutionLog(runId, {
          level: 'success',
          stepIndex,
          stepId,
          message: `Received response from Anthropic (${model})`,
          details: {
            provider: 'Anthropic',
            model: response.model,
            latencyMs: latency,
            usage,
            responseLength: content.length,
            responsePreview: content.substring(0, 200),
            stopReason: response.stop_reason,
          },
        });
        console.error(`[Anthropic] Successfully logged response for run ${runId}`);
      } catch (logError) {
        console.error(`[Anthropic] Failed to log response:`, logError);
      }
    }

    return {
      content,
      usage,
      model: response.model,
      finishReason: response.stop_reason || undefined,
      functionCall: functionCallResponse,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    let errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { status?: number })?.status;

    // Check for token limit errors and provide better error messages
    if (errorMessage.includes('prompt is too long') || errorMessage.includes('tokens >') || errorMessage.includes('maximum')) {
      const tokenCountStr = estimatedTokens !== undefined 
        ? estimatedTokens.toLocaleString() 
        : 'unknown';
      const maxTokens = getMaxContextTokens(model);
      const maxTokensStr = maxTokens >= 1_000_000 
        ? '1M' 
        : maxTokens >= 1_000 
        ? `${maxTokens / 1_000}K` 
        : maxTokens.toString();
      
      errorMessage = `Prompt exceeds token limit: ${errorMessage}. Estimated tokens: ${tokenCountStr}. Model ${model} supports up to ${maxTokensStr} tokens (${maxTokens.toLocaleString()}). Please reduce the prompt size, remove unnecessary content, or split the request into smaller chunks.`;
    }

    // Log LLM error
    if (runId) {
      await addExecutionLog(runId, {
        level: 'error',
        stepIndex,
        stepId,
        message: `Anthropic API error`,
        details: {
          provider: 'Anthropic',
          model,
          error: errorMessage,
          statusCode,
          estimatedTokens,
          latencyMs: latency,
          promptLength: prompt.length,
          fileCount: files.length,
        },
      });
    }

    const llmError: LLMError = {
      message: errorMessage,
      statusCode,
    };

    throw llmError;
  }
}
