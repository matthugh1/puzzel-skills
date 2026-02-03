/**
 * OpenAI LLM Integration
 * Handles calls to OpenAI API with comprehensive logging
 */

import OpenAI from 'openai';
import { addExecutionLog } from '../runtime/execution-logger';
import type { LLMConfig, LLMResponse, LLMError, FileAttachment } from './types';

// Re-export types for backward compatibility
export type { LLMConfig, LLMResponse, LLMError, FileAttachment } from './types';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({
      apiKey,
    });
  }
  return openaiClient;
}

/**
 * Call OpenAI API with a prompt and optional file attachments
 */
export async function callOpenAI(
  prompt: string,
  config: LLMConfig = {},
  runId?: string,
  stepIndex?: number,
  stepId?: string
): Promise<LLMResponse> {
  const client = getOpenAIClient();
  const model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 2000;
  const files = config.files || [];

  const startTime = Date.now();

  // Build message content array (text + file attachments)
  // OpenAI supports string or array of content parts
  const messageContentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    { type: 'text', text: prompt },
  ];

  // Add file attachments
  // OpenAI Chat Completions API: Images as base64, documents as extracted text
  // We extract text locally (like ChatGPT web interface does) rather than using Files API
  for (const fileAttachment of files) {
    const { metadata } = fileAttachment;
    
    if (metadata.isImage) {
      // For images, include as base64-encoded image_url (for vision models)
      try {
        // Dynamic import to avoid bundling file-storage in client code
        const { loadFileBuffer } = await import('../file-storage');
        const buffer = await loadFileBuffer(fileAttachment.ref);
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${metadata.mimeType};base64,${base64}`;
        
        messageContentParts.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        });
        
        console.error(`[OpenAI] Image attached: ${metadata.name} (${metadata.mimeType})`);
      } catch (error) {
        console.error(`[OpenAI] Error loading image file ${fileAttachment.ref}:`, error);
        // Continue without this file attachment
      }
    } else {
      // For documents (PDFs, .docx, etc.), extract text locally and include in prompt
      // This is how ChatGPT web interface works - extract text server-side before sending
      try {
        // Dynamic import to avoid bundling file-storage in client code
        const { loadFile } = await import('../file-storage');
        
        console.error(`[OpenAI] Extracting text locally from: ${metadata.name} (${metadata.mimeType})`);
        
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
            
            console.error(`[OpenAI] Extracted text from .docx using mammoth: ${textContent.length} chars`);
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
            console.error(`[OpenAI] Error loading file content:`, loadError);
            
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
        
        console.error(`[OpenAI] File content included in prompt: ${metadata.name} (${textContent.length} chars)`);
        
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
        
        console.error(`[OpenAI] Error extracting text from file ${fileAttachment.ref}:`, error);
        console.error(`[OpenAI] Error details:`, errorDetails);
        
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
        
        // Fallback: include file reference with error message
        messageContentParts.push({
          type: 'text',
          text: `\n\n[File attachment: ${metadata.name} (${metadata.mimeType}) - Text extraction failed: ${errorMessage}]`,
        });
      }
    }
  }
  
  // Use array format if we have multiple parts, otherwise use string for single text prompt
  const messageContent = messageContentParts.length > 1 || files.length > 0 
    ? messageContentParts 
    : prompt;

  // Log LLM request
  if (runId) {
    await addExecutionLog(runId, {
      level: 'info',
      stepIndex,
      stepId,
      message: `Sending request to OpenAI (${model})`,
      details: {
        provider: 'OpenAI',
        model,
        temperature,
        maxTokens,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200),
        fileCount: files.length,
        imageCount: files.filter(f => f.metadata.isImage).length,
      },
    });
  }

  try {
    console.error(`[OpenAI] Starting API call for run ${runId}, step ${stepIndex} with ${files.length} file(s)`);
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    console.error(`[OpenAI] API call completed for run ${runId}, step ${stepIndex}`);
    const latency = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';
    console.error(`[OpenAI] Response content length: ${content.length} for run ${runId}`);
    const usage = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined;

    // Log LLM response
    if (runId) {
      console.error(`[OpenAI] Logging response for run ${runId}, step ${stepIndex}`);
      try {
        await addExecutionLog(runId, {
          level: 'success',
          stepIndex,
          stepId,
          message: `Received response from OpenAI (${model})`,
          details: {
            provider: 'OpenAI',
            model: response.model,
            latencyMs: latency,
            usage,
            responseLength: content.length,
            responsePreview: content.substring(0, 200),
            finishReason: response.choices[0]?.finish_reason,
          },
        });
        console.error(`[OpenAI] Successfully logged response for run ${runId}`);
      } catch (logError) {
        console.error(`[OpenAI] Failed to log response:`, logError);
      }
    }

    return {
      content,
      usage,
      model: response.model,
      finishReason: response.choices[0]?.finish_reason || undefined,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = (error as { status?: number })?.status;

    // Log LLM error
    if (runId) {
      await addExecutionLog(runId, {
        level: 'error',
        stepIndex,
        stepId,
        message: `OpenAI API error`,
        details: {
          provider: 'OpenAI',
          model,
          error: errorMessage,
          statusCode,
          latencyMs: latency,
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
