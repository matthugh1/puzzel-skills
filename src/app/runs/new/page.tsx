'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { runsApi } from '@/lib/api-client';
import Link from 'next/link';

interface ContextField {
  key: string;
  value: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  goal: string;
  contextFields: ContextField[];
}

const TEMPLATES: Template[] = [
  {
    id: 'contract-review',
    name: 'Contract Review',
    description: 'Analyze contracts for red flags and unfavorable terms',
    goal: 'Analyze the contract and identify any red flags or unfavorable terms',
    contextFields: [
      { key: 'ticketId', value: '' },
      { key: 'filePath', value: '' },
    ],
  },
  {
    id: 'code-analysis',
    name: 'Code Analysis',
    description: 'Review code for bugs, security issues, or improvements',
    goal: 'Review the code for bugs, security issues, and suggest improvements',
    contextFields: [
      { key: 'repo', value: '' },
      { key: 'filePath', value: '' },
      { key: 'branch', value: 'main' },
    ],
  },
  {
    id: 'document-summary',
    name: 'Document Summary',
    description: 'Create summaries of long documents',
    goal: 'Create a concise summary of the document highlighting key points',
    contextFields: [
      { key: 'documentUrl', value: '' },
      { key: 'summaryLength', value: '500' },
    ],
  },
];

export default function CreateRunPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [contextFields, setContextFields] = useState<ContextField[]>([
    { key: '', value: '' },
  ]);

  const addContextField = () => {
    setContextFields([...contextFields, { key: '', value: '' }]);
  };

  const removeContextField = (index: number) => {
    setContextFields(contextFields.filter((_, i) => i !== index));
  };

  const updateContextField = (index: number, field: Partial<ContextField>) => {
    const updated = [...contextFields];
    updated[index] = { ...updated[index], ...field };
    setContextFields(updated);
  };

  const applyTemplate = (template: Template) => {
    setSelectedTemplate(template.id);
    setGoal(template.goal);
    setContextFields(template.contextFields.map(f => ({ ...f })));
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setGoal('');
    setContextFields([{ key: '', value: '' }]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build initial context object from form fields
      const initialContext: Record<string, unknown> = {};
      for (const field of contextFields) {
        if (field.key.trim()) {
          // Try to parse as JSON if it looks like JSON, otherwise use as string
          let parsedValue: unknown = field.value;
          if (field.value.trim().startsWith('{') || field.value.trim().startsWith('[')) {
            try {
              parsedValue = JSON.parse(field.value);
            } catch {
              // If parsing fails, use as string
              parsedValue = field.value;
            }
          } else if (field.value.trim() === 'true' || field.value.trim() === 'false') {
            parsedValue = field.value.trim() === 'true';
          } else if (!isNaN(Number(field.value)) && field.value.trim() !== '') {
            parsedValue = Number(field.value);
          }
          initialContext[field.key.trim()] = parsedValue;
        }
      }

      const response = await runsApi.create({
        goal,
        initialContext,
      });

      // Redirect to run detail page
      router.push(`/runs/${(response.run as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run');
      setLoading(false);
    }
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
          Create a New Agent
        </h1>
      </header>

      <main className="page-content">
        {/* Template Gallery */}
        {!selectedTemplate && (
          <div
            style={{
              maxWidth: '1000px',
              margin: '0 auto var(--spacing-xl)',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: 'var(--spacing-md)',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Start from a template
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-lg)',
              }}
            >
              Choose a template to get started quickly, or create your own below.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-xl)',
              }}
            >
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  style={{
                    padding: 'var(--spacing-lg)',
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.background = 'var(--color-primary-5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.background = 'var(--color-surface)';
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-xs)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {template.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                      margin: 0,
                    }}
                  >
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--spacing-lg)',
                borderTop: '1px solid var(--color-border)',
                marginTop: 'var(--spacing-lg)',
              }}
            >
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  margin: 0,
                }}
              >
                Or create your own agent from scratch below
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-lg)',
          }}
        >
          {/* Step Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
              }}
            >
              1
            </div>
            <div
              style={{
                flex: 1,
                height: '2px',
                background: 'var(--color-border)',
              }}
            />
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: goal.trim() ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                color: goal.trim() ? 'var(--color-on-primary)' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
              }}
            >
              2
            </div>
          </div>

          {selectedTemplate && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-primary-10)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-text)' }}>
                  Using template: {TEMPLATES.find(t => t.id === selectedTemplate)?.name}
                </strong>
              </div>
              <button
                type="button"
                onClick={clearTemplate}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Clear
              </button>
            </div>
          )}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
            }}
          >
            <label
              htmlFor="goal"
              style={{
                display: 'block',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: 600,
                color: 'var(--color-text)',
                fontSize: '1rem',
              }}
            >
              Step 1: What do you want your agent to do? *
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
              rows={4}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text)',
                background: 'var(--color-background)',
              }}
              placeholder="Example: Analyze the contract in ticket #12345 and identify any red flags or unfavorable terms."
            />
            <p
              style={{
                marginTop: 'var(--spacing-sm)',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              Describe your task in plain language. Your agent will learn which skills to use to complete it.
            </p>
          </div>

          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  fontSize: '1rem',
                }}
              >
                Step 2: Add any helpful details (Optional)
              </label>
              <button
                type="button"
                onClick={addContextField}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                + Add Field
              </button>
            </div>
            <p
              style={{
                marginBottom: 'var(--spacing-md)',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              Provide any details that will help your agent complete the task. For example: ticket numbers, file paths, or other relevant information.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
              }}
            >
              {contextFields.map((field, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-md)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Field name (e.g., ticketId, filePath)"
                      value={field.key}
                      onChange={(e) => updateContextField(index, { key: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                        background: 'var(--color-background)',
                        marginBottom: 'var(--spacing-xs)',
                      }}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <input
                      type="text"
                      placeholder="Value (e.g., 12345, contracts/agreement.pdf)"
                      value={field.value}
                      onChange={(e) => updateContextField(index, { value: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text)',
                        background: 'var(--color-background)',
                      }}
                    />
                  </div>
                  {contextFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContextField(index)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'transparent',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {contextFields.length === 0 && (
              <button
                type="button"
                onClick={addContextField}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text)',
                  border: '2px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                + Add Information Field
              </button>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger-text)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !goal.trim()}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: loading || !goal.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                opacity: loading || !goal.trim() ? 0.6 : 1,
              }}
            >
              {loading ? 'Creating Agent...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
