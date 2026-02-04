'use client';

import { useState, useRef, useEffect } from 'react';
import { workspacesApi } from '@/lib/api-client';

// Client-safe file reference check (doesn't import server-side dependencies)
function isFileReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('__file__:');
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'message' | 'skill_result' | 'tool_result' | 'app_action_result';
  metadata?: {
    skillId?: string;
    toolId?: string;
    result?: unknown;
    canEscalate?: boolean;
    selectedTools?: Array<{ id: string; name: string; description: string }>;
  };
}

interface ChatInterfaceProps {
  workspaceId: string;
  selectedSkill?: { id: string; name: string } | null;
  selectedTool?: { id: string; name: string } | null;
  selectedIntegration?: { appName: string; actionName: string } | null;
  onSkillSelect?: (skillId: string) => void;
  onSkillDeselect?: () => void;
  onToolSelect?: (toolId: string) => void;
  onToolDeselect?: () => void;
  onIntegrationActionDeselect?: () => void;
  onEscalate?: (context: { skillId?: string; toolId?: string; result?: unknown }) => void;
}

export function ChatInterface({ workspaceId, selectedSkill, selectedTool, selectedIntegration, onSkillDeselect, onToolDeselect, onIntegrationActionDeselect, onEscalate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your workspace AI assistant. I can help you accomplish tasks, execute skills, use tools, and turn successful outcomes into agent runs. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleToolExecute = async (toolId: string) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const messagesToSend = messages
        .map(m => ({ role: m.role, content: m.content.trim() }))
        .filter(m => m.content.length > 0);

      // Extract content from conversation for tool execution
      // Prefer the last assistant message (which might have formatted content)
      // Otherwise use the last user message or combine conversation
      const lastMessage = messages[messages.length - 1];
      const secondLastMessage = messages[messages.length - 2];
      
      let contentToUse = '';
      if (lastMessage.role === 'assistant' && lastMessage.content) {
        // Use assistant's response (might be formatted/processed content)
        contentToUse = lastMessage.content;
      } else if (secondLastMessage && secondLastMessage.role === 'assistant' && secondLastMessage.content) {
        // Use previous assistant message
        contentToUse = secondLastMessage.content;
      } else if (lastMessage.content) {
        // Use last message (user or assistant)
        contentToUse = lastMessage.content;
      } else {
        // Fallback: combine all user messages
        const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
        contentToUse = userMessages.join('\n\n');
      }

      // Execute tool with content extracted from conversation
      // The backend will map this to the correct argument name based on tool schema
      const response = await workspacesApi.chat(workspaceId, messagesToSend, {
        toolId,
        toolArgs: { 
          input: contentToUse, // Backend will map 'input' to 'content' if needed
          content: contentToUse, // Also pass as 'content' directly
        },
      });

      const toolMessage: Message = {
        role: 'assistant',
        content: response.response.content,
        type: response.response.type,
        metadata: {
          toolId: response.response.toolId,
          result: response.response.result,
          canEscalate: response.response.canEscalate,
        },
      };

      setMessages([...messages, toolMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute tool';
      setError(errorMessage);
      console.error('Tool execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !attachedFile) return;
    if (loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim() || (attachedFile ? `[File attached: ${attachedFile.name}]` : ''),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const messageToSend = input.trim();
    const fileToSend = attachedFile;
    setInput('');
    setAttachedFile(null);
    setLoading(true);
    setError(null);

    try {
      // Ensure all messages have non-empty content or a file
      const messagesToSend = newMessages
        .map(m => ({ role: m.role, content: m.content.trim() }))
        .filter(m => m.content.length > 0);
      
      if (messagesToSend.length === 0 && !fileToSend) {
        throw new Error('No valid messages or files to send');
      }
      
      // If skill, tool, or integration action is selected, use it with the user's message
      // Note: If tool is selected but we're not executing it yet, just pass toolId without toolArgs
      const options: { skillId?: string; toolId?: string; toolArgs?: Record<string, unknown>; appId?: string; actionId?: string; actionParams?: Record<string, unknown> } = {};
      if (selectedSkill) {
        options.skillId = selectedSkill.id;
      }
      // Always pass toolId if selected (even if skill is also selected) so LLM can mention it
      if (selectedTool) {
        // Only pass toolArgs if we're actually executing (which happens via button click)
        // For regular chat, just pass toolId so LLM knows it's selected
        options.toolId = selectedTool.id;
        // Don't pass toolArgs here - tool execution happens via button click
      }
      // Pass integration action info if selected
      if (selectedIntegration) {
        options.appId = selectedIntegration.appName;
        options.actionId = selectedIntegration.actionName;
        // Parse user input as action params (simple key=value format or JSON)
        // For now, we'll let the backend handle parsing
        options.actionParams = { userInput: input.trim() };
      }
      
      const files = fileToSend ? new Map([['file', fileToSend]]) : undefined;
      const response = await workspacesApi.chat(workspaceId, messagesToSend, { ...options, files });

      console.log('[ChatInterface] Response received:', {
        type: response.response.type,
        hasSelectedTools: !!(response.response as { selectedTools?: unknown }).selectedTools,
        selectedTools: (response.response as { selectedTools?: Array<{ id: string; name: string; description: string }> }).selectedTools,
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response.content,
        type: response.response.type,
        metadata: {
          skillId: response.response.skillId,
          toolId: response.response.toolId,
          appId: (response.response as { appId?: string }).appId,
          actionId: (response.response as { actionId?: string }).actionId,
          result: response.response.result,
          canEscalate: response.response.canEscalate,
          selectedTools: (response.response as { selectedTools?: Array<{ id: string; name: string; description: string }> }).selectedTools,
        },
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (err) {
      let errorMessage = 'Failed to get response';
      let errorDetails: unknown = null;
      
      if (err instanceof Error) {
        errorMessage = err.message;
        // Try to extract more details from error
        const errorObj = err as Error & { details?: string | unknown; message?: string };
        if (errorObj.details !== undefined) {
          // Handle details - ensure it's always converted to a string
          if (typeof errorObj.details === 'string') {
            errorDetails = errorObj.details;
            errorMessage = `${errorMessage}\n\n${errorObj.details}`;
          } else if (Array.isArray(errorObj.details)) {
            // Format validation errors nicely
            const formattedErrors = errorObj.details.map((e: { path?: string[]; message?: string }) => 
              `${e.path?.join('.') || 'unknown'}: ${e.message || 'Invalid'}`
            ).join('; ');
            errorDetails = formattedErrors;
            errorMessage = `${errorMessage}: ${formattedErrors}`;
          } else if (typeof errorObj.details === 'object' && errorObj.details !== null) {
            // If details is an object, try to stringify it properly
            try {
              const detailsStr = JSON.stringify(errorObj.details, null, 2);
              errorDetails = detailsStr;
              errorMessage = `${errorMessage}\n\nDetails:\n${detailsStr}`;
            } catch (stringifyError) {
              errorDetails = String(errorObj.details);
              errorMessage = `${errorMessage}: ${String(errorObj.details)}`;
            }
          } else {
            errorDetails = String(errorObj.details);
            errorMessage = `${errorMessage}: ${String(errorObj.details)}`;
          }
        }
      }
      
      console.error('[ChatInterface] Chat error:', err);
      if (errorDetails) {
        console.error('[ChatInterface] Error details:', errorDetails);
      }
      console.error('[ChatInterface] Final error message:', errorMessage);
      
      // Set error message - truncate if too long for UI
      const displayError = errorMessage.length > 500 
        ? `${errorMessage.substring(0, 500)}... (see console for full error)`
        : errorMessage;
      setError(displayError);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: errorDetails 
            ? `Sorry, I encountered a validation error. ${errorMessage}. Please check your input and try again.`
            : `Sorry, I encountered an error: ${errorMessage}. Could you try again?`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxWidth: '100%',
      }}
    >
      {error && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        {messages.map((message, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '75%',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                background:
                  message.role === 'user'
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)',
                color: message.role === 'user' ? 'white' : 'var(--color-text)',
                border:
                  message.role === 'assistant'
                    ? '1px solid var(--color-border)'
                    : 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
              
              {/* Show download link if tool result contains a file reference */}
              {(() => {
                // Check if this is a tool result with a file reference
                if (message.type !== 'tool_result' || !message.metadata?.result) {
                  return null;
                }
                
                const result = message.metadata.result as { success?: boolean; output?: string; error?: string };
                const output = result?.output;
                
                // Check if output is a file reference, or extract from content if it contains a file reference
                let fileRef: string | null = null;
                if (output && typeof output === 'string' && isFileReference(output)) {
                  fileRef = output;
                } else if (message.content) {
                  // Try to extract file reference from message content
                  const fileRefMatch = message.content.match(/__file__:[^\s\n]+/);
                  if (fileRefMatch) {
                    fileRef = fileRefMatch[0];
                  }
                }
                
                if (!fileRef) {
                  return null;
                }
                
                const encodedRef = encodeURIComponent(fileRef);
                // Extract filename from file reference: __file__:runId/filename.docx
                let fileName = 'document.docx';
                if (fileRef.includes('/')) {
                  fileName = fileRef.split('/').pop() || 'document.docx';
                  // Remove __file__: prefix if present
                  fileName = fileName.replace('__file__:', '');
                } else {
                  fileName = fileRef.replace('__file__:', '') || 'document.docx';
                }
                // Ensure .docx extension for Word documents
                if (!fileName.endsWith('.docx') && !fileName.includes('.')) {
                  fileName = `${fileName}.docx`;
                }
                
                return (
                  <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    <a
                      href={`/api/files/${encodedRef}`}
                      download={fileName}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-primary)',
                        color: 'white',
                        textDecoration: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        width: 'fit-content',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-primary-dark)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--color-primary)';
                      }}
                    >
                      <span>📄</span>
                      <span>Download {fileName}</span>
                    </a>
                  </div>
                );
              })()}
              
              {/* Show tool execution buttons if tools are selected */}
              {message.metadata?.selectedTools && message.metadata.selectedTools.length > 0 && (
                <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                    Available tools:
                  </div>
                  {message.metadata.selectedTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolExecute(tool.id)}
                      disabled={loading}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      🔧 Run {tool.name}
                    </button>
                  ))}
                </div>
              )}

              {message.metadata?.canEscalate && onEscalate && (
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                  <button
                    onClick={() => onEscalate({
                      skillId: message.metadata?.skillId,
                      toolId: message.metadata?.toolId,
                      result: message.metadata?.result,
                    })}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Turn into Agent Run
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
            }}
          >
            <div
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => handleSend(e)}
        style={{
          padding: 'var(--spacing-lg)',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-background)',
        }}
      >
        {selectedSkill && (
          <div
            style={{
              marginBottom: 'var(--spacing-md)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'var(--color-primary)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {selectedSkill.name}
              {onSkillDeselect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onSkillDeselect();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: 'var(--spacing-xs)',
                    fontSize: '1rem',
                    lineHeight: 1,
                  }}
                  aria-label="Remove skill"
                >
                  ×
                </button>
              )}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Using this skill with your message
            </span>
          </div>
        )}
        {attachedFile && (
          <div
            style={{
              marginBottom: 'var(--spacing-md)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-surface-secondary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
              📎 {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)
            </span>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                fontSize: '1rem',
                lineHeight: 1,
              }}
              aria-label="Remove file"
            >
              ×
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setAttachedFile(file);
            }}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
            aria-label="Attach file"
            title="Attach file"
          >
            📎
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              selectedSkill 
                ? `Type your message to use with ${selectedSkill.name}...` 
                : selectedTool 
                ? `Type your message to use with ${selectedTool.name}...`
                : selectedIntegration
                ? `Type parameters for ${selectedIntegration.appName}:${selectedIntegration.actionName}...`
                : 'Type your message...'
            }
            disabled={loading}
            style={{
              flex: 1,
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '1rem',
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text)',
              background: 'var(--color-background)',
              resize: 'none',
              minHeight: '60px',
              maxHeight: '200px',
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !attachedFile) || loading}
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: (!input.trim() && !attachedFile) || loading ? 'not-allowed' : 'pointer',
              opacity: (!input.trim() && !attachedFile) || loading ? 0.6 : 1,
              fontFamily: 'var(--font-body)',
              whiteSpace: 'nowrap',
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
