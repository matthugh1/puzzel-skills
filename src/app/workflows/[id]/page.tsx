'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workflowsApi } from '@/lib/api-client';
import Link from 'next/link';
import { SharingDialog } from '@/components/workflows/SharingDialog';
import { TestRunner } from '@/components/workflows/TestRunner';

interface WorkflowRun {
  id: string;
  goal: string;
  status: string;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  plan: {
    steps: Array<{
      type: string;
      config: Record<string, unknown>;
    }>;
    metadata?: {
      version?: string;
      description?: string;
    };
  };
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility: 'TEAM' | 'ORG';
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  runs?: WorkflowRun[];
  _count?: {
    runs: number;
  };
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkflow();
    }
  }, [id]);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workflowsApi.getById(id);
      setWorkflow(response.workflow as Workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
      console.error('Error loading workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!workflow) return;

    try {
      setRunning(true);
      const response = await workflowsApi.run(workflow.id, {
        initialContext: {},
      });
      // Redirect to the run detail page
      router.push(`/runs/${(response.run as { id: string }).id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to run workflow');
      console.error('Error running workflow:', err);
    } finally {
      setRunning(false);
    }
  };

  const handlePublish = async () => {
    if (!workflow || workflow.status !== 'DRAFT') return;

    if (!confirm('Publish this workflow? You can unpublish it later to make edits.')) {
      return;
    }

    try {
      await workflowsApi.publish(workflow.id);
      await loadWorkflow(); // Reload to get updated status
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish workflow');
      console.error('Error publishing workflow:', err);
    }
  };

  const handleUnpublish = async () => {
    if (!workflow || workflow.status !== 'PUBLISHED') return;

    if (!confirm('Unpublish this workflow? This will allow you to edit it, but it will no longer be available for running until republished.')) {
      return;
    }

    try {
      await workflowsApi.unpublish(workflow.id);
      await loadWorkflow(); // Reload to get updated status
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unpublish workflow');
      console.error('Error unpublishing workflow:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' };
      case 'DRAFT':
        return { bg: 'var(--color-accent-bg)', text: 'var(--color-accent-text)' };
      case 'ARCHIVED':
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
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
            Loading workflow...
          </div>
        </main>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>Error:</strong> {error || 'Workflow not found'}
          </div>
        </main>
      </div>
    );
  }

  const statusColors = getStatusColor(workflow.status);

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
                {workflow.name}
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
                {workflow.status.toLowerCase()}
              </span>
            </div>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                margin: 'var(--spacing-xs) 0 0 var(--spacing-xl)',
              }}
            >
              Updated: {formatDate(workflow.updatedAt)} • Created: {formatDate(workflow.createdAt)}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-md)',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setShowTestRunner(true)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Test Workflow
            </button>
            {workflow.status === 'PUBLISHED' && (
              <button
                onClick={handleRun}
                disabled={running}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1,
                }}
              >
                {running ? 'Running...' : 'Run Workflow'}
              </button>
            )}
            {workflow.status === 'DRAFT' && (
              <button
                onClick={handlePublish}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Publish
              </button>
            )}
            {workflow.status === 'PUBLISHED' && (
              <button
                onClick={handleUnpublish}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-warning-bg)',
                  color: 'var(--color-warning-text)',
                  border: '1px solid var(--color-warning-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Unpublish
              </button>
            )}
            <button
              onClick={() => setShowSharing(true)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Share
            </button>
            <Link
              href={`/workflows/${workflow.id}/history`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              History
            </Link>
            <Link
              href={`/workflows/${workflow.id}/activity`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Activity
            </Link>
            <Link
              href={`/workflows/${workflow.id}/analytics`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Analytics
            </Link>
            <Link
              href={`/workflows/${workflow.id}/data`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Data View
            </Link>
            <Link
              href={`/workflows/${workflow.id}/edit`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Edit
            </Link>
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
          {/* Workflow Info */}
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
              Workflow Information
            </h2>
            {workflow.description && (
              <p
                style={{
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-md)',
                }}
              >
                {workflow.description}
              </p>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'var(--spacing-md)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Status:</strong>
                <div style={{ color: 'var(--color-text)' }}>{workflow.status}</div>
              </div>
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Visibility:</strong>
                <div style={{ color: 'var(--color-text)' }}>{workflow.visibility}</div>
              </div>
              {workflow.category && (
                <div>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Category:</strong>
                  <div style={{ color: 'var(--color-text)' }}>{workflow.category}</div>
                </div>
              )}
              <div>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Owner:</strong>
                <div style={{ color: 'var(--color-text)' }}>
                  {workflow.owner.name || workflow.owner.email}
                </div>
              </div>
            </div>
            {workflow.tags.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-md)' }}>
                <strong style={{ color: 'var(--color-text-secondary)' }}>Tags:</strong>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-xs)',
                    flexWrap: 'wrap',
                    marginTop: 'var(--spacing-xs)',
                  }}
                >
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: 'var(--color-surface-secondary)',
                        color: 'var(--color-text-secondary)',
                        padding: '2px var(--spacing-xs)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Workflow Plan */}
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
              Workflow Plan
            </h2>
            {workflow.plan.steps.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }}>No steps defined</p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
                {workflow.plan.steps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-surface-secondary)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <strong>Step {index + 1}:</strong> {step.type}
                    {step.config && Object.keys(step.config).length > 0 && (
                      <details
                        style={{
                          marginTop: 'var(--spacing-xs)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <summary style={{ cursor: 'pointer', color: 'var(--color-primary)' }}>
                          View Configuration
                        </summary>
                        <pre
                          style={{
                            marginTop: 'var(--spacing-xs)',
                            padding: 'var(--spacing-sm)',
                            background: 'var(--color-background)',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'auto',
                            fontSize: '0.75rem',
                          }}
                        >
                          {JSON.stringify(step.config, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Runs */}
          {workflow.runs && workflow.runs.length > 0 && (
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
                Recent Runs
              </h2>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-sm)',
                }}
              >
                {workflow.runs.map((run) => {
                  const runStatusColors = getStatusColor(run.status);
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
                        <div>
                          <strong>{run.goal}</strong>
                          <div
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.875rem',
                              marginTop: 'var(--spacing-xs)',
                            }}
                          >
                            {formatDate(run.createdAt)} • {run.user.name || run.user.email}
                          </div>
                        </div>
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
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {showSharing && (
        <SharingDialog workflowId={workflow.id} onClose={() => setShowSharing(false)} />
      )}
      {showTestRunner && (
        <TestRunner
          workflowId={workflow.id}
          plan={workflow.plan}
          onClose={() => setShowTestRunner(false)}
        />
      )}
    </div>
  );
}
