'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workflowsApi, foldersApi } from '@/lib/api-client';
import Link from 'next/link';
import { FolderTree } from '@/components/workflows/FolderTree';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility: 'TEAM' | 'ORG';
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    runs: number;
  };
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, [selectedFolderId]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use fetch with folderId query param if needed
      // When selectedFolderId is null, we want workflows without folders (folderId=null)
      // When selectedFolderId is set, we want workflows in that folder
      const url = selectedFolderId !== null
        ? `/api/workflows?folderId=${selectedFolderId}`
        : '/api/workflows?folderId=null';
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load workflows: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setWorkflows(data.workflows as Workflow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowMove = async (workflowId: string, folderId: string | null) => {
    try {
      await workflowsApi.moveToFolder(workflowId, folderId);
      await loadWorkflows();
    } catch (err) {
      console.error('Error moving workflow:', err);
      alert('Failed to move workflow');
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
            Workflows
          </h1>
          <Link
            href="/workflows/new"
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
            + New Workflow
          </Link>
        </div>
      </header>

      <main className="page-content">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '250px 1fr',
            gap: 'var(--spacing-lg)',
            alignItems: 'flex-start',
          }}
        >
          <aside
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-md)',
              position: 'sticky',
              top: 'var(--spacing-lg)',
            }}
          >
            <FolderTree
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
              onWorkflowMove={handleWorkflowMove}
            />
          </aside>
          <div style={{ flex: 1 }}>
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
            Loading workflows...
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

        {!loading && !error && workflows.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-md)' }}>
              No workflows yet
            </p>
            <Link
              href="/workflows/new"
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
              Create Your First Workflow
            </Link>
          </div>
        )}

        {!loading && !error && workflows.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            {workflows.map((workflow) => {
              const statusColors = getStatusColor(workflow.status);
              return (
                <div
                  key={workflow.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    // Store workflow ID in a custom way since we can't use dataTransfer.setData in React
                    (e.target as HTMLElement).setAttribute('data-workflow-id', workflow.id);
                  }}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-lg)',
                    marginBottom: 'var(--spacing-md)',
                    cursor: 'move',
                  }}
                >
                  <Link
                    href={`/workflows/${workflow.id}`}
                    style={{
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
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            margin: '0 0 var(--spacing-xs) 0',
                          }}
                        >
                          {workflow.description}
                        </p>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          gap: 'var(--spacing-md)',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            margin: 0,
                          }}
                        >
                          Updated: {formatDate(workflow.updatedAt)}
                        </p>
                        {workflow.category && (
                          <span
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.875rem',
                            }}
                          >
                            • {workflow.category}
                          </span>
                        )}
                        {workflow._count && workflow._count.runs > 0 && (
                          <span
                            style={{
                              color: 'var(--color-text-secondary)',
                              fontSize: '0.875rem',
                            }}
                          >
                            • {workflow._count.runs} run{workflow._count.runs !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {workflow.tags.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: 'var(--spacing-xs)',
                            flexWrap: 'wrap',
                            marginTop: 'var(--spacing-sm)',
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
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-xs)',
                        alignItems: 'flex-end',
                        marginLeft: 'var(--spacing-md)',
                      }}
                    >
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
                        }}
                      >
                        {workflow.status.toLowerCase()}
                      </span>
                      <span
                        style={{
                          background: 'var(--color-surface-secondary)',
                          color: 'var(--color-text-secondary)',
                          padding: '4px var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                        }}
                      >
                        {workflow.visibility.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
          </div>
        </div>
      </main>
    </div>
  );
}
