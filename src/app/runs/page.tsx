'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runsApi } from '@/lib/api-client';
import Link from 'next/link';

interface AgentRun {
  id: string;
  goal: string;
  status: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      // Note: We'll need to add a GET /api/runs endpoint to list runs
      // For now, this is a placeholder that will need the endpoint
      const response = await runsApi.list();
      setRuns(response.runs as AgentRun[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
      console.error('Error loading runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' };
      case 'RUNNING':
        return { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)' };
      case 'BLOCKED':
        return { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' };
      case 'FAILED':
        return { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' };
      case 'CANCELLED':
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
      case 'PLANNING':
        return { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-text)' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            My Agents
          </h1>
          <Link
            href="/runs/new"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            + New Agent
          </Link>
        </div>
      </header>

      <main className="page-content">
        {loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading agents...
          </div>
        )}

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

        {!loading && !error && runs.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-md)' }}>
              No agents yet
            </p>
            <Link
              href="/runs/new"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
                fontFamily: 'var(--font-body)',
              }}
            >
              Create Your First Agent
            </Link>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {runs.map((run) => {
              const statusColors = getStatusColor(run.status);
              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-lg)',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
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
                      <h3
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          margin: '0 0 var(--spacing-xs) 0',
                          fontFamily: 'var(--font-display)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {run.goal}
                      </h3>
                      <p
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                          margin: 0,
                        }}
                      >
                        Created: {formatDate(run.createdAt)}
                        {run.startedAt && ` • Started: ${formatDate(run.startedAt)}`}
                        {run.completedAt && ` • Completed: ${formatDate(run.completedAt)}`}
                      </p>
                    </div>
                    <span
                      style={{
                        background: statusColors.bg,
                        color: statusColors.text,
                        padding: '4px var(--spacing-sm)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                        marginLeft: 'var(--spacing-md)',
                      }}
                    >
                      {run.status.toLowerCase()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
