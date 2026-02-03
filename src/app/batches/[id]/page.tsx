'use client';

/**
 * Batch Run Detail Page
 * Shows batch execution progress and individual run statuses
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { batchesApi } from '@/lib/api-client';

interface BatchRun {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  totalItems: number;
  completedItems: number;
  failedItems: number;
  concurrency: number;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  workflow: {
    id: string;
    name: string;
    description: string | null;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  runs: Array<{
    id: string;
    batchIndex: number;
    status: string;
    goal: string;
    initialContext: Record<string, unknown>;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
  }>;
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [batch, setBatch] = useState<BatchRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadBatch();
      // Poll for updates if batch is still running
      const interval = setInterval(() => {
        if (batch && (batch.status === 'PENDING' || batch.status === 'RUNNING')) {
          loadBatch();
        }
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [id, batch?.status]);

  const loadBatch = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await batchesApi.getById(id);
      setBatch(response.batch as BatchRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch');
      console.error('Error loading batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'RUNNING':
        return { bg: '#dbeafe', text: '#1e40af' };
      case 'FAILED':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'CANCELLED':
        return { bg: '#f3f4f6', text: '#6b7280' };
      case 'PENDING':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'RUNNING':
      case 'PLANNING':
        return { bg: '#dbeafe', text: '#1e40af' };
      case 'FAILED':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'CANCELLED':
        return { bg: '#f3f4f6', text: '#6b7280' };
      case 'BLOCKED':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  const progressPercentage =
    batch && batch.totalItems > 0
      ? ((batch.completedItems + batch.failedItems) / batch.totalItems) * 100
      : 0;

  if (loading && !batch) {
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
            Loading batch...
          </div>
        </main>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>Error:</strong> {error || 'Batch not found'}
          </div>
        </main>
      </div>
    );
  }

  const statusColors = getStatusColor(batch.status);

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
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              <Link
                href="/workflows"
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
                aria-label="Back to workflows"
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
                Batch Run: {batch.workflow.name}
              </h1>
              <span
                style={{
                  background: statusColors.bg,
                  color: statusColors.text,
                  padding: '6px var(--spacing-md)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}
              >
                {batch.status.toLowerCase()}
              </span>
            </div>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                margin: 'var(--spacing-xs) 0 0 var(--spacing-xl)',
              }}
            >
              Started: {formatDate(batch.startedAt)} •{' '}
              {batch.completedAt ? `Completed: ${formatDate(batch.completedAt)}` : 'In progress'}
            </p>
          </div>
        </div>
      </header>

      <main className="page-content">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-lg)',
          }}
        >
          {/* Batch Summary */}
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
                fontSize: '1.5rem',
                fontWeight: 600,
                margin: '0 0 var(--spacing-md) 0',
                color: 'var(--color-text)',
              }}
            >
              Batch Summary
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Total Items:</strong>
                <div style={{ color: 'var(--color-text)', fontSize: '1.25rem', fontWeight: 600 }}>
                  {batch.totalItems}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Completed:</strong>
                <div style={{ color: '#065f46', fontSize: '1.25rem', fontWeight: 600 }}>
                  {batch.completedItems}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Failed:</strong>
                <div style={{ color: '#991b1b', fontSize: '1.25rem', fontWeight: 600 }}>
                  {batch.failedItems}
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Concurrency:</strong>
                <div style={{ color: 'var(--color-text)', fontSize: '1.25rem', fontWeight: 600 }}>
                  {batch.concurrency}
                </div>
              </div>
            </div>
            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '24px',
                background: 'var(--color-surface-secondary)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                marginTop: 'var(--spacing-md)',
              }}
            >
              <div
                style={{
                  width: `${progressPercentage}%`,
                  height: '100%',
                  background: 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {Math.round(progressPercentage)}%
              </div>
            </div>
          </div>

          {/* Individual Runs */}
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
                fontSize: '1.5rem',
                fontWeight: 600,
                margin: '0 0 var(--spacing-md) 0',
                color: 'var(--color-text)',
              }}
            >
              Individual Runs
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
              }}
            >
              {batch.runs.map((run) => {
                const runStatusColors = getRunStatusColor(run.status);
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-surface-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)',
                            marginBottom: 'var(--spacing-xs)',
                          }}
                        >
                          <strong>Item {run.batchIndex + 1}</strong>
                          <span
                            style={{
                              background: runStatusColors.bg,
                              color: runStatusColors.text,
                              padding: '4px var(--spacing-sm)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textTransform: 'capitalize',
                            }}
                          >
                            {run.status.toLowerCase()}
                          </span>
                        </div>
                        <div
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            marginTop: 'var(--spacing-xs)',
                          }}
                        >
                          {run.goal}
                        </div>
                        {(run.startedAt || run.completedAt || run.failedAt) && (
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.75rem',
                              marginTop: 'var(--spacing-xs)',
                            }}
                          >
                            {run.startedAt && `Started: ${formatDate(run.startedAt)}`}
                            {run.completedAt && ` • Completed: ${formatDate(run.completedAt)}`}
                            {run.failedAt && ` • Failed: ${formatDate(run.failedAt)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
