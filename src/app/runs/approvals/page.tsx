'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { runsApi } from '@/lib/api-client';

interface RunApproval {
  id: string;
  requestedAt: Date | string;
  approvedAt: Date | string | null;
  rejectedAt: Date | string | null;
  requestedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  reason: string | null;
}

interface AgentRun {
  id: string;
  goal: string;
  status: string;
  plan: { steps: Array<{ skillId: string; skillVersionId: string; description: string }> } | null;
  blockedReason: string | null;
  approvals: RunApproval[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    loadBlockedRuns();
  }, []);

  const loadBlockedRuns = async () => {
    try {
      setLoading(true);
      setError(null);
      // Load all runs and filter for blocked ones
      const response = await runsApi.list();
      const allRuns = response.runs as AgentRun[];
      const blockedRuns = allRuns.filter((run) => run.status === 'BLOCKED');
      // Load full details for blocked runs
      const detailedRuns = await Promise.all(
        blockedRuns.map((run) => runsApi.getById(run.id).then((r) => r.run as AgentRun))
      );
      setRuns(detailedRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blocked runs');
      console.error('Error loading blocked runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (runId: string) => {
    if (!confirm('Are you sure you want to approve this run?')) return;

    try {
      setApproving(runId);
      await runsApi.approve(runId);
      await loadBlockedRuns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve run');
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (runId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason || !reason.trim()) return;

    try {
      setRejecting(runId);
      await runsApi.reject(runId, reason);
      await loadBlockedRuns();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject run');
    } finally {
      setRejecting(null);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
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
          Run Approvals
        </h1>
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
            Loading blocked runs...
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
            <p style={{ fontSize: '1.125rem' }}>No runs pending approval</p>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
            }}
          >
            {runs.map((run) => {
              const pendingApproval = run.approvals.find(
                (a) => !a.approvedAt && !a.rejectedAt
              );
              return (
                <div
                  key={run.id}
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
                      marginBottom: 'var(--spacing-md)',
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
                        Requested by: {run.user.email} • {formatDate(pendingApproval?.requestedAt)}
                      </p>
                      {run.blockedReason && (
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            marginTop: 'var(--spacing-xs)',
                          }}
                        >
                          Reason: {run.blockedReason}
                        </p>
                      )}
                      {pendingApproval?.reason && (
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            marginTop: 'var(--spacing-xs)',
                          }}
                        >
                          Approval reason: {pendingApproval.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {run.plan && (
                    <div
                      style={{
                        marginBottom: 'var(--spacing-md)',
                        padding: 'var(--spacing-md)',
                        background: 'var(--color-surface-secondary)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: 'var(--spacing-sm)' }}>
                        Plan ({run.plan.steps.length} steps):
                      </strong>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        {run.plan.steps.map((step, index) => (
                          <div key={index} style={{ fontSize: '0.875rem' }}>
                            {index + 1}. {step.description}
                          </div>
                        ))}
                      </div>
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
                      onClick={() => router.push(`/runs/${run.id}`)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
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
                      View Details
                    </button>
                    <button
                      onClick={() => handleReject(run.id)}
                      disabled={rejecting === run.id}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-danger-bg)',
                        color: 'var(--color-danger-text)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: rejecting === run.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-body)',
                        opacity: rejecting === run.id ? 0.6 : 1,
                      }}
                    >
                      {rejecting === run.id ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApprove(run.id)}
                      disabled={approving === run.id}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: approving === run.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font-body)',
                        opacity: approving === run.id ? 0.6 : 1,
                      }}
                    >
                      {approving === run.id ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
