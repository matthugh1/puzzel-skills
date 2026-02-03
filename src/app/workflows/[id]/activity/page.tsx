'use client';

/**
 * Workflow Activity Log Page
 * Shows activity log for a workflow
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { workflowsApi } from '@/lib/api-client';

interface Activity {
  type: 'audit' | 'run';
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

export default function WorkflowActivityPage() {
  const params = useParams();
  const id = params.id as string;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadActivity();
    }
  }, [id, eventTypeFilter]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/workflows/${id}/activity${eventTypeFilter ? `?eventType=${encodeURIComponent(eventTypeFilter)}` : ''}`;
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load activity');
      }
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'workflow.created': 'Workflow Created',
      'workflow.updated': 'Workflow Updated',
      'workflow.archived': 'Workflow Archived',
      'workflow.published': 'Workflow Published',
      'workflow.shared': 'Workflow Shared',
      'workflow.unshared': 'Workflow Unshared',
      'run.running': 'Run Started',
      'run.completed': 'Run Completed',
      'run.failed': 'Run Failed',
      'run.cancelled': 'Run Cancelled',
      'run.blocked': 'Run Blocked',
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
            Loading activity...
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
            Activity Log
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

        <div
          style={{
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <input
            type="text"
            placeholder="Filter by event type..."
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {activities.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            No activity found
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {activities.map((activity) => (
              <div
                key={`${activity.type}-${activity.id}`}
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
                      {getActionLabel(activity.action)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      by {activity.user.name || activity.user.email} • {formatDate(activity.createdAt)}
                    </div>
                  </div>
                  {activity.type === 'run' && (
                    <Link
                      href={`/runs/${activity.id}`}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-sm)',
                        background: 'var(--color-surface-secondary)',
                        color: 'var(--color-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                      }}
                    >
                      View Run
                    </Link>
                  )}
                </div>
                {activity.details && Object.keys(activity.details).length > 0 && (
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
                      {JSON.stringify(activity.details, null, 2)}
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
