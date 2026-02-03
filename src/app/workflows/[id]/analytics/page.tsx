'use client';

/**
 * Workflow Analytics Page
 * Shows analytics dashboard for workflow performance
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Analytics {
  metrics: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    errorRate: number;
    avgDurationMs: number;
    avgDurationSeconds: number;
  };
  timeSeries: Array<{
    date: string;
    total: number;
    completed: number;
    failed: number;
  }>;
}

export default function WorkflowAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadAnalytics();
    }
  }, [id]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/workflows/${id}/analytics`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
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
            Loading analytics...
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
            Analytics
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

        {analytics && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
            }}
          >
            {/* Key Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--spacing-md)',
              }}
            >
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
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Total Runs
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  {analytics.metrics.totalRuns}
                </div>
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
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Success Rate
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--color-success-text)',
                  }}
                >
                  {analytics.metrics.successRate.toFixed(1)}%
                </div>
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
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Avg Duration
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                  }}
                >
                  {formatDuration(analytics.metrics.avgDurationSeconds)}
                </div>
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
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--spacing-xs)',
                  }}
                >
                  Error Rate
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: 'var(--color-danger-text)',
                  }}
                >
                  {analytics.metrics.errorRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Time Series Chart */}
            {analytics.timeSeries.length > 0 && (
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
                    margin: '0 0 var(--spacing-lg) 0',
                    color: 'var(--color-text)',
                  }}
                >
                  Runs Over Time (Last 30 Days)
                </h2>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-sm)',
                  }}
                >
                  {analytics.timeSeries.map((point) => {
                    const maxTotal = Math.max(
                      ...analytics.timeSeries.map((p) => p.total),
                      1
                    );
                    const completedWidth = (point.completed / maxTotal) * 100;
                    const failedWidth = (point.failed / maxTotal) * 100;
                    return (
                      <div key={point.date}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ color: 'var(--color-text)' }}>
                            {new Date(point.date).toLocaleDateString()}
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            {point.total} runs
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            height: '24px',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            background: 'var(--color-surface-secondary)',
                          }}
                        >
                          {point.completed > 0 && (
                            <div
                              style={{
                                width: `${completedWidth}%`,
                                background: 'var(--color-success-text)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-on-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {point.completed}
                            </div>
                          )}
                          {point.failed > 0 && (
                            <div
                              style={{
                                width: `${failedWidth}%`,
                                background: 'var(--color-danger-text)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--color-on-primary)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {point.failed}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
