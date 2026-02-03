'use client';

import { useEffect, useState } from 'react';
import { skillsApi, apiRequest } from '@/lib/api-client';
import { ApprovalCard } from '@/components/approvals/ApprovalCard';

interface PendingVersion {
  id: string;
  version: number;
  content: string;
  changeNotes: string | null;
  createdAt: Date | string;
  skill: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    tags: string[];
  };
  createdBy: { name: string | null; email: string };
}

export default function ApprovalsPage() {
  const [versions, setVersions] = useState<PendingVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [submitterFilter, setSubmitterFilter] = useState<string>('');

  useEffect(() => {
    loadPendingApprovals();
  }, [categoryFilter, submitterFilter]);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (submitterFilter) params.set('submitter', submitterFilter);

      const response = await apiRequest<{ versions: PendingVersion[] }>(
        `/api/approvals${params.toString() ? `?${params.toString()}` : ''}`
      );
      setVersions(response.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
      console.error('Error loading approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique categories
  const categories = Array.from(
    new Set(versions.map((v) => v.skill.category).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
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
            Approval Queue
          </h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {versions.length} {versions.length === 1 ? 'item' : 'items'} pending
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              value={submitterFilter}
              onChange={(e) => setSubmitterFilter(e.target.value)}
              placeholder="Filter by submitter..."
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          {categories.length > 0 && (
            <div>
              <select
                value={categoryFilter || ''}
                onChange={(e) => setCategoryFilter(e.target.value || null)}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            Loading pending approvals...
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

        {!loading && !error && versions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-sm)' }}>
              No pending approvals
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              All submissions have been reviewed
            </p>
          </div>
        )}

        {!loading && !error && versions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {versions.map((version) => (
              <ApprovalCard
                key={version.id}
                skillId={version.skill.id}
                versionId={version.id}
                skillName={version.skill.name}
                skillDescription={version.skill.description}
                category={version.skill.category}
                versionNumber={version.version}
                submittedAt={version.createdAt}
                submittedBy={version.createdBy}
                changeNotes={version.changeNotes}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
