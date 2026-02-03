'use client';

/**
 * Workflow Edit History Page
 * Shows audit log of workflow changes
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { workflowsApi } from '@/lib/api-client';

interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  details: Record<string, unknown> | null;
}

export default function WorkflowHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadHistory();
    }
  }, [id]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workflowsApi.getHistory(id);
      setHistory(response.history as AuditLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'workflow.created': 'Created',
      'workflow.updated': 'Updated',
      'workflow.archived': 'Archived',
      'workflow.published': 'Published',
      'workflow.shared': 'Shared',
      'workflow.unshared': 'Unshared',
    };
    return labels[action] || action;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
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
            Loading history...
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
            Workflow History
          </h1>
        </div>
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

        {history.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            No history available
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {history.map((log) => (
              <div
                key={log.id}
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
                    alignItems: 'flex-start',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        marginBottom: 'var(--spacing-xs)',
                      }}
                    >
                      {getActionLabel(log.action)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      by {log.user.name || log.user.email} • {formatDate(log.createdAt)}
                    </div>
                  </div>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <details
                    style={{
                      marginTop: 'var(--spacing-md)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer',
                        color: 'var(--color-primary)',
                        fontWeight: 500,
                      }}
                    >
                      View Details
                    </summary>
                    <pre
                      style={{
                        marginTop: 'var(--spacing-sm)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--color-surface-secondary)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'auto',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
