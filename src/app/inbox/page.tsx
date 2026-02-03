'use client';

/**
 * User Inbox Page
 * Unified inbox for tasks, data inputs, approvals, and path selections
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tasksApi, dataInputsApi, runsApi } from '@/lib/api-client';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stepIndex: number;
  createdAt: string;
  run: {
    id: string;
    goal: string;
    workflow: {
      id: string;
      name: string;
    } | null;
  };
}

interface DataInput {
  id: string;
  inputSchema: Record<string, unknown>;
  status: string;
  stepIndex: number;
  createdAt: string;
  run: {
    id: string;
    goal: string;
    workflow: {
      id: string;
      name: string;
    } | null;
  };
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dataInputs, setDataInputs] = useState<DataInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'data-inputs'>('tasks');

  useEffect(() => {
    loadInbox();
    // Poll for updates
    const interval = setInterval(loadInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadInbox = async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksResponse, dataInputsResponse] = await Promise.all([
        tasksApi.list('PENDING'),
        dataInputsApi.list('PENDING'),
      ]);

      setTasks((tasksResponse.tasks as Task[]).filter((t) => t.status === 'PENDING'));
      setDataInputs((dataInputsResponse.dataInputs as DataInput[]).filter((d) => d.status === 'PENDING'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
      console.error('Error loading inbox:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await tasksApi.complete(taskId, {});
      await loadInbox();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleSubmitDataInput = async (dataInputId: string, data: Record<string, unknown>) => {
    try {
      await dataInputsApi.submit(dataInputId, { data });
      await loadInbox();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit data input');
    }
  };

  if (loading && tasks.length === 0 && dataInputs.length === 0) {
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
            Loading inbox...
          </div>
        </main>
      </div>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === 'PENDING');
  const pendingDataInputs = dataInputs.filter((d) => d.status === 'PENDING');

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
          Inbox
        </h1>
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

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            borderBottom: '1px solid var(--color-border)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <button
            onClick={() => setActiveTab('tasks')}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: activeTab === 'tasks' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'tasks' ? 'white' : 'var(--color-text)',
              border: 'none',
              borderBottom: activeTab === 'tasks' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
            }}
          >
            Tasks ({pendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('data-inputs')}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: activeTab === 'data-inputs' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'data-inputs' ? 'white' : 'var(--color-text)',
              border: 'none',
              borderBottom: activeTab === 'data-inputs' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
            }}
          >
            Data Inputs ({pendingDataInputs.length})
          </button>
        </div>

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {pendingTasks.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--spacing-2xl)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No pending tasks
              </div>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
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
                          color: 'var(--color-text)',
                        }}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            marginBottom: 'var(--spacing-sm)',
                          }}
                        >
                          {task.description}
                        </p>
                      )}
                      <div
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <Link
                          href={`/runs/${task.run.id}`}
                          style={{
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                          }}
                        >
                          Run: {task.run.goal}
                        </Link>
                        {task.run.workflow && (
                          <>
                            {' • '}
                            <Link
                              href={`/workflows/${task.run.workflow.id}`}
                              style={{
                                color: 'var(--color-primary)',
                                textDecoration: 'none',
                              }}
                            >
                              Workflow: {task.run.workflow.name}
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      style={{
                        padding: 'var(--spacing-sm) var(--spacing-lg)',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Data Inputs Tab */}
        {activeTab === 'data-inputs' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {pendingDataInputs.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--spacing-2xl)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No pending data input requests
              </div>
            ) : (
              pendingDataInputs.map((dataInput) => (
                <DataInputForm
                  key={dataInput.id}
                  dataInput={dataInput}
                  onSubmit={(data) => handleSubmitDataInput(dataInput.id, data)}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DataInputForm({
  dataInput,
  onSubmit,
}: {
  dataInput: DataInput;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const schema = dataInput.inputSchema as {
    type?: string;
    properties?: Record<string, { type: string; title?: string; description?: string }>;
    required?: string[];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: '0 0 var(--spacing-xs) 0',
            color: 'var(--color-text)',
          }}
        >
          Data Input Request
        </h3>
        <div
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Link
            href={`/runs/${dataInput.run.id}`}
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
            }}
          >
            Run: {dataInput.run.goal}
          </Link>
          {dataInput.run.workflow && (
            <>
              {' • '}
              <Link
                href={`/workflows/${dataInput.run.workflow.id}`}
                style={{
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                }}
              >
                Workflow: {dataInput.run.workflow.name}
              </Link>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          {schema.properties &&
            Object.entries(schema.properties).map(([key, field]) => (
              <div key={key}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'var(--spacing-xs)',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                  }}
                >
                  {field.title || key}
                  {schema.required?.includes(key) && <span style={{ color: 'red' }}> *</span>}
                </label>
                {field.description && (
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    {field.description}
                  </p>
                )}
                {field.type === 'string' && (
                  <input
                    type="text"
                    required={schema.required?.includes(key)}
                    value={(formData[key] as string) || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    required={schema.required?.includes(key)}
                    value={(formData[key] as number) || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: parseFloat(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                )}
                {field.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={(formData[key] as boolean) || false}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                    style={{
                      width: '20px',
                      height: '20px',
                    }}
                  />
                )}
              </div>
            ))}
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            fontFamily: 'var(--font-body)',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
