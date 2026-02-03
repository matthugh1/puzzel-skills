'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/tools');
      if (!response.ok) {
        throw new Error('Failed to load tools');
      }
      const data = await response.json();
      setTools(data.tools || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
      console.error('Error loading tools:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Tools
          </h1>
          <Link
            href="/my-skills/new"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            Create Skill
          </Link>
        </div>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--color-text-secondary)',
            marginTop: 'var(--spacing-md)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Reusable tools that can be used by skills to perform specific operations without LLM calls.
        </p>
      </header>

      <main className="page-content">
        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading tools...</p>
          </div>
        ) : tools.length === 0 ? (
          <div
            style={{
              padding: 'var(--spacing-xl)',
              background: 'var(--color-surface-secondary)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--color-text-secondary)' }}>No tools available.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>
            {tools.map((tool) => (
              <div
                key={tool.id}
                style={{
                  padding: 'var(--spacing-lg)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-md)' }}>
                  <div>
                    <h3
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: 'var(--spacing-xs)',
                        fontFamily: 'var(--font-display)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {tool.name}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                        margin: 0,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {tool.description}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: 'var(--color-surface-secondary)',
                      color: 'var(--color-text)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {tool.id}
                  </span>
                </div>

                <div style={{ marginTop: 'var(--spacing-md)' }}>
                  <h4
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-sm)',
                      color: 'var(--color-text)',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Input Parameters
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                    {Object.entries(tool.inputSchema.properties || {}).map(([key, prop]) => {
                      const isRequired = tool.inputSchema.required?.includes(key);
                      return (
                        <div
                          key={key}
                          style={{
                            padding: 'var(--spacing-sm)',
                            background: 'var(--color-surface-secondary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.875rem',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                            <code
                              style={{
                                fontWeight: 600,
                                color: 'var(--color-primary)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {key}
                            </code>
                            {isRequired && (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                }}
                              >
                                Required
                              </span>
                            )}
                            <span
                              style={{
                                color: 'var(--color-text-muted)',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              ({prop.type})
                            </span>
                          </div>
                          {prop.description && (
                            <p
                              style={{
                                margin: 'var(--spacing-xs) 0 0 0',
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.875rem',
                              }}
                            >
                              {prop.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
