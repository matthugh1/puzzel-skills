'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { runsApi } from '@/lib/api-client';

interface RunStep {
  id: string;
  stepIndex: number;
  status: string;
  inputContext: Record<string, unknown>;
  outputContext: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  skillVersion: {
    id: string;
    version: number;
    skillId: string;
  };
}

interface AgentRun {
  id: string;
  goal: string;
  status: string;
  plan: { steps: Array<{ skillId: string; skillVersionId: string; description: string }> } | null;
  initialContext: Record<string, unknown>;
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
  cancellationReason: string | null;
  blockedReason: string | null;
  steps: RunStep[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  policy: {
    id: string;
    name: string;
  } | null;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runId) {
      loadRun();
    }
  }, [runId]);

  const loadRun = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await runsApi.getById(runId);
      setRun(response.run as AgentRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
      console.error('Error loading run:', err);
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
      case 'BLOCKED':
        return { bg: '#fef3c7', text: '#92400e' };
      case 'FAILED':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'CANCELLED':
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
      case 'PLANNING':
        return { bg: '#e9d5ff', text: '#6b21a8' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
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
            Loading run...
          </div>
        </main>
      </div>
    );
  }

  if (error || !run) {
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
            <strong>Error:</strong> {error || 'Run not found'}
          </div>
        </main>
      </div>
    );
  }

  const statusColors = getStatusColor(run.status);

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
          <div>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                margin: '0 0 var(--spacing-xs) 0',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              {run.goal}
            </h1>
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
              padding: '6px var(--spacing-md)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {run.status.toLowerCase()}
          </span>
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
          {/* Run Info */}
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
              Run Information
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--spacing-md)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Status:</strong>
                <div style={{ color: 'var(--color-text)' }}>{run.status}</div>
              </div>
              {run.policy && (
                <div>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Policy:</strong>
                  <div style={{ color: 'var(--color-text)' }}>{run.policy.name}</div>
                </div>
              )}
              {run.blockedReason && (
                <div>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Blocked Reason:</strong>
                  <div style={{ color: 'var(--color-text)' }}>{run.blockedReason}</div>
                </div>
              )}
              {run.cancellationReason && (
                <div>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Cancellation Reason:</strong>
                  <div style={{ color: 'var(--color-text)' }}>{run.cancellationReason}</div>
                </div>
              )}
            </div>
          </div>

          {/* Plan */}
          {run.plan && (
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
                Plan
              </h2>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
                {run.plan.steps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-surface-secondary)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <strong>Step {index + 1}:</strong> {step.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
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
              Execution Steps
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
              }}
            >
              {run.steps.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>No steps executed yet</p>
              ) : (
                run.steps.map((step) => {
                  const stepStatusColors = getStatusColor(step.status);
                  return (
                    <div
                      key={step.id}
                      style={{
                        padding: 'var(--spacing-md)',
                        background: 'var(--color-surface-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
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
                        <strong>Step {step.stepIndex + 1}</strong>
                        <span
                          style={{
                            background: stepStatusColors.bg,
                            color: stepStatusColors.text,
                            padding: '2px var(--spacing-sm)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            textTransform: 'capitalize',
                          }}
                        >
                          {step.status.toLowerCase()}
                        </span>
                      </div>
                      {step.errorMessage && (
                        <div
                          style={{
                            padding: 'var(--spacing-sm)',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: 'var(--radius-sm)',
                            marginTop: 'var(--spacing-sm)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <strong>Error:</strong> {step.errorMessage}
                        </div>
                      )}
                      {step.outputContext && (
                        <details
                          style={{
                            marginTop: 'var(--spacing-sm)',
                            fontSize: '0.875rem',
                          }}
                        >
                          <summary style={{ cursor: 'pointer', color: 'var(--color-primary)' }}>
                            View Output
                          </summary>
                          <pre
                            style={{
                              marginTop: 'var(--spacing-sm)',
                              padding: 'var(--spacing-sm)',
                              background: 'var(--color-background)',
                              borderRadius: 'var(--radius-sm)',
                              overflow: 'auto',
                              fontSize: '0.75rem',
                            }}
                          >
                            {JSON.stringify(step.outputContext, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
