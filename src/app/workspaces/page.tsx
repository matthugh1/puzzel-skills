'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WorkspaceMember {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  owner: {
    id: string;
    name: string | null;
    email: string;
  };
  members: WorkspaceMember[];
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    slug: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/workspaces', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load workspaces: ${response.status}`);
      }
      const data = await response.json();
      setWorkspaces(data.workspaces as Workspace[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      console.error('Error loading workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrf-token='))
        ?.split('=')[1];

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        body: JSON.stringify(createFormData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create workspace');
      }

      const data = await response.json();
      setShowCreateForm(false);
      setCreateFormData({ name: '', description: '', slug: '' });
      await loadWorkspaces();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create workspace');
      console.error('Error creating workspace:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            margin: 0,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
          }}>
            Department Workspaces
          </h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {showCreateForm ? 'Cancel' : '+ New Workspace'}
          </button>
        </div>
      </header>

      <main className="page-content">
        {showCreateForm && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'var(--color-surface)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border)',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginTop: 0,
              marginBottom: '1rem',
              color: 'var(--color-text)',
            }}>
              Create New Workspace
            </h2>
            <form onSubmit={handleCreateWorkspace}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCreateFormData({
                      ...createFormData,
                      name,
                      slug: generateSlug(name),
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}>
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={createFormData.slug}
                  onChange={(e) => setCreateFormData({ ...createFormData, slug: e.target.value })}
                  pattern="^[a-z0-9-]+$"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                  }}
                />
                <p style={{
                  marginTop: '0.25rem',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                }}>
                  URL-friendly identifier (lowercase letters, numbers, and hyphens only)
                </p>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}>
                  Description
                </label>
                <textarea
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    background: 'var(--color-background)',
                    color: 'var(--color-text)',
                    resize: 'vertical',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={createLoading}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: createLoading ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: createLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {createLoading ? 'Creating...' : 'Create Workspace'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading workspaces...
          </div>
        ) : error ? (
          <div style={{
            padding: '1rem',
            background: 'var(--color-error-bg)',
            color: 'var(--color-error-text)',
            borderRadius: '0.375rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        ) : workspaces.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <p>No workspaces found. Create your first workspace to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/workspaces/${workspace.id}`}
                style={{
                  display: 'block',
                  padding: '1.5rem',
                  background: 'var(--color-surface)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--color-text)',
                  }}>
                    {workspace.name}
                  </h3>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: workspace.isActive ? 'var(--color-success-bg)' : 'var(--color-surface-secondary)',
                    color: workspace.isActive ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
                  }}>
                    {workspace.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {workspace.description && (
                  <p style={{
                    marginTop: '0.5rem',
                    marginBottom: '0.5rem',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.875rem',
                  }}>
                    {workspace.description}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '1rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                }}>
                  <span>Slug: <code style={{ background: 'var(--color-surface-secondary)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>{workspace.slug}</code></span>
                  <span>Owner: {workspace.owner.name || workspace.owner.email}</span>
                  <span>Members: {workspace.members.length}</span>
                  <span>Created: {formatDate(workspace.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
