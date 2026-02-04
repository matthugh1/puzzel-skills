'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { runsApi } from '@/lib/api-client';

interface Run {
  id: string;
  goal: string;
  status: string;
  createdAt: string;
}

interface RecentActivitySidebarProps {
  workspaceId: string;
}

export function RecentActivitySidebar({ workspaceId }: RecentActivitySidebarProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecentRuns();
  }, [workspaceId]);

  const loadRecentRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await runsApi.list({ limit: 10 });
      setRuns((response.runs as Run[]).slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent runs');
      console.error('Error loading recent runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' };
      case 'FAILED':
        return { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' };
      case 'RUNNING':
        return { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-text)' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        borderLeft: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            color: 'var(--color-text)',
          }}
        >
          Recent Activity
        </h3>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-sm)',
        }}
      >
        {loading && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            No recent runs
          </div>
        )}

        {!loading && !error && runs.map((run) => {
          const statusColors = getStatusColor(run.status);
          return (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              style={{
                display: 'block',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-sm)',
                background: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-background)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {run.goal}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: statusColors.bg,
                    color: statusColors.text,
                  }}
                >
                  {run.status}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {new Date(run.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
