'use client';

/**
 * Workflow Data View Page
 * Shows all context variables and data flow through workflow
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface DataView {
  contextVariables: string[];
  stepOutputs: Array<{
    stepId: string;
    stepType: string;
    outputs: string[];
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    initialContext: Record<string, unknown>;
    steps: Array<{
      stepIndex: number;
      output: unknown;
      errorMessage: string | null;
    }>;
  }>;
}

export default function WorkflowDataViewPage() {
  const params = useParams();
  const id = params.id as string;
  const [dataView, setDataView] = useState<DataView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadDataView();
    }
  }, [id]);

  const loadDataView = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/workflows/${id}/data-view`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load data view');
      }
      const data = await response.json();
      setDataView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data view');
      console.error('Error loading data view:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading data view...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          <Link
            href={`/workflows/${id}`}
            style={{
              padding: 'var(--spacing-sm)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            aria-label="Back to workflow"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Data View
          </h1>
        </div>
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

        {dataView && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
            }}
          >
            {/* Context Variables */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--color-text)',
                }}
              >
                Context Variables
              </h2>
              {dataView.contextVariables.length === 0 ? (
                <p
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.875rem',
                  }}
                >
                  No context variables found
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  {dataView.contextVariables.map((variable) => (
                    <code
                      key={variable}
                      style={{
                        background: 'var(--color-surface-secondary)',
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        color: 'var(--color-primary)',
                      }}
                    >
                      {variable}
                    </code>
                  ))}
                </div>
              )}
            </div>

            {/* Step Outputs */}
            {dataView.stepOutputs.length > 0 && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-lg)',
                }}
              >
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: '0 0 var(--spacing-md) 0',
                    color: 'var(--color-text)',
                  }}
                >
                  Step Outputs
                </h2>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  {dataView.stepOutputs.map((step) => (
                    <div
                      key={step.stepId}
                      style={{
                        padding: 'var(--spacing-sm)',
                        background: 'var(--color-surface-secondary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        {step.stepId} ({step.stepType})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        {step.outputs.map((output) => (
                          <code
                            key={output}
                            style={{
                              background: 'var(--color-surface)',
                              padding: '2px var(--spacing-xs)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              color: 'var(--color-primary)',
                            }}
                          >
                            {output}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Runs */}
            {dataView.recentRuns.length > 0 && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-lg)',
                }}
              >
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: '0 0 var(--spacing-md) 0',
                    color: 'var(--color-text)',
                  }}
                >
                  Recent Runs Data Flow
                </h2>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  {dataView.recentRuns.map((run) => (
                    <div
                      key={run.id}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-md)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 'var(--spacing-sm)',
                        }}
                      >
                        <Link
                          href={`/runs/${run.id}`}
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          Run {run.id.slice(0, 8)}...
                        </Link>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px var(--spacing-xs)',
                            background: 'var(--color-surface-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-secondary)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {run.status}
                        </span>
                      </div>
                      <details
                        style={{
                          fontSize: '0.875rem',
                        }}
                      >
                        <summary
                          style={{
                            cursor: 'pointer',
                            color: 'var(--color-primary)',
                            fontWeight: 500,
                            marginBottom: 'var(--spacing-xs)',
                          }}
                        >
                          View Data
                        </summary>
                        <div
                          style={{
                            marginTop: 'var(--spacing-sm)',
                            padding: 'var(--spacing-sm)',
                            background: 'var(--color-surface-secondary)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <div style={{ marginBottom: 'var(--spacing-sm)' }}>
                            <strong>Initial Context:</strong>
                            <pre
                              style={{
                                marginTop: 'var(--spacing-xs)',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                overflow: 'auto',
                              }}
                            >
                              {JSON.stringify(run.initialContext, null, 2)}
                            </pre>
                          </div>
                          {run.steps.length > 0 && (
                            <div>
                              <strong>Step Outputs:</strong>
                              {run.steps.map((step) => (
                                <div
                                  key={step.stepIndex}
                                  style={{
                                    marginTop: 'var(--spacing-xs)',
                                    padding: 'var(--spacing-xs)',
                                    background: 'var(--color-surface)',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <div style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                    Step {step.stepIndex}:
                                  </div>
                                  {step.errorMessage ? (
                                    <div
                                      style={{
                                        color: 'var(--color-danger-text)',
                                        fontSize: '0.75rem',
                                      }}
                                    >
                                      Error: {step.errorMessage}
                                    </div>
                                  ) : (
                                    <pre
                                      style={{
                                        marginTop: 'var(--spacing-xs)',
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace',
                                        overflow: 'auto',
                                      }}
                                    >
                                      {JSON.stringify(step.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
