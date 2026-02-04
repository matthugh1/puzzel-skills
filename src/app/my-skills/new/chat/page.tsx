'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SkillProposal {
  name: string;
  description?: string;
  content: string;
  category?: string;
  tags?: string[];
  inputContract?: Record<string, unknown>;
  outputContract?: Record<string, unknown>;
}

export default function ChatSkillPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'ll help you create a new skill. Just tell me what you want the skill to do, and I\'ll create a complete prompt template for you. What would you like this skill to accomplish?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SkillProposal | null>(null);
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await skillsApi.compose(newMessages);

      if (response.response.type === 'proposal' && response.response.skill) {
        // Received a skill proposal
        setProposal(response.response.skill);
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: `Great! I've gathered all the information. Here's what I've prepared for your skill. Please review and confirm to create it.`,
          },
        ]);
      } else {
        // Received a question
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: response.response.question || 'Could you tell me more?',
          },
        ]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      setError(errorMessage);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Could you try again?',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSkill = async () => {
    if (!proposal) return;

    setCreating(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: proposal.name.trim(),
        content: proposal.content.trim(),
        visibility: 'ORG', // Default visibility
      };

      if (proposal.description && proposal.description.trim()) {
        payload.description = proposal.description.trim();
      }
      if (proposal.category && proposal.category.trim()) {
        payload.category = proposal.category.trim();
      }
      if (proposal.tags && proposal.tags.length > 0) {
        payload.tags = proposal.tags;
      }
      if (proposal.inputContract) {
        payload.inputContract = proposal.inputContract;
      }
      if (proposal.outputContract) {
        payload.outputContract = proposal.outputContract;
      }

      const response = await skillsApi.create(payload);
      router.push(`/my-skills/${(response.skill as { id: string }).id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create skill';
      setError(errorMessage);
      console.error('Error creating skill:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleEditProposal = () => {
    setProposal(null);
    setMessages([
      ...messages,
      {
        role: 'user',
        content: 'I\'d like to make some changes to the proposal.',
      },
    ]);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            margin: 0,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
          }}
        >
          Create Skill with AI
        </h1>
      </header>

      <main className="page-content">
        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {proposal ? (
          // Show proposal confirmation UI
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div
              style={{
                padding: 'var(--spacing-xl)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: 'var(--spacing-lg)',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text)',
                }}
              >
                Review Your Skill
              </h2>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Name
                </label>
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-background)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                >
                  {proposal.name}
                </div>
              </div>

              {proposal.description && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    Description
                  </label>
                  <div
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-background)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {proposal.description}
                  </div>
                </div>
              )}

              {proposal.category && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    Category
                  </label>
                  <div
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-background)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {proposal.category}
                  </div>
                </div>
              )}

              {proposal.tags && proposal.tags.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    Tags
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                    {proposal.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-sm)',
                          background: 'var(--color-primary)',
                          color: 'white',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Prompt Content
                </label>
                <div
                  style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--color-background)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {proposal.content}
                </div>
              </div>

              {(proposal.inputContract || proposal.outputContract) && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    Contracts
                  </label>
                  {proposal.inputContract && (
                    <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Input:</strong>
                      <pre
                        style={{
                          padding: 'var(--spacing-sm)',
                          background: 'var(--color-background)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.75rem',
                          overflowX: 'auto',
                          marginTop: 'var(--spacing-xs)',
                        }}
                      >
                        {JSON.stringify(proposal.inputContract, null, 2)}
                      </pre>
                    </div>
                  )}
                  {proposal.outputContract && (
                    <div>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Output:</strong>
                      <pre
                        style={{
                          padding: 'var(--spacing-sm)',
                          background: 'var(--color-background)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.75rem',
                          overflowX: 'auto',
                          marginTop: 'var(--spacing-xs)',
                        }}
                      >
                        {JSON.stringify(proposal.outputContract, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                <button
                  onClick={handleCreateSkill}
                  disabled={creating}
                  style={{
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.6 : 1,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {creating ? 'Creating...' : 'Create Skill'}
                </button>
                <button
                  onClick={handleEditProposal}
                  disabled={creating}
                  style={{
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Make Changes
                </button>
                <button
                  onClick={() => router.back()}
                  disabled={creating}
                  style={{
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Show chat interface
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxWidth: '900px',
              margin: '0 auto',
            }}
          >
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
              onSubmit={handleSend}
              style={{
                padding: 'var(--spacing-lg)',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-background)',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-end' }}>
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
                  placeholder="Type your message..."
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
                  disabled={!input.trim() || loading}
                  style={{
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                    opacity: !input.trim() || loading ? 0.6 : 1,
                    fontFamily: 'var(--font-body)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
