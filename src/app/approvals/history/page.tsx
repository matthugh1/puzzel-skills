'use client';

import { useEffect, useState } from 'react';
import { skillsApi } from '@/lib/api-client';
import Link from 'next/link';

interface HistoryVersion {
  id: string;
  version: number;
  status: string;
  createdAt: Date | string;
  approvedAt: Date | string | null;
  changeNotes: string | null;
  rejectionReason: string | null;
  skill: {
    id: string;
    name: string;
    category: string | null;
  };
  createdBy: { name: string | null; email: string };
  approvedBy: { name: string | null; email: string } | null;
}

export default function ApprovalHistoryPage() {
  const [history, setHistory] = useState<HistoryVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, [statusFilter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all skills and filter for approved/rejected versions
      // In a real app, you'd want a dedicated endpoint for this
      const allSkills = await skillsApi.list({ status: 'PUBLISHED' });
      
      // For now, we'll need to get versions from each skill
      // This is a simplified approach - in production, create a dedicated endpoint
      const historyItems: HistoryVersion[] = [];
      
      // Get a few skills to demonstrate (in production, use a proper endpoint)
      for (const skill of (allSkills.skills as Array<{ id: string }>).slice(0, 10)) {
        try {
          const skillData = await skillsApi.getById(skill.id);
          const skillWithVersions = skillData.skill as {
            id: string;
            name: string;
            category: string | null;
            versions: HistoryVersion[];
          };
          
          const approvedRejectedVersions = skillWithVersions.versions
            .filter((v) => v.status === 'PUBLISHED' || v.status === 'REJECTED')
            .map((v) => ({
              ...v,
              skill: {
                id: skillWithVersions.id,
                name: skillWithVersions.name,
                category: skillWithVersions.category,
              },
            }));
          
          historyItems.push(...approvedRejectedVersions);
        } catch (err) {
          // Skip skills that fail to load
          console.error(`Failed to load skill ${skill.id}:`, err);
        }
      }

      // Sort by approval date (most recent first)
      historyItems.sort((a, b) => {
        const dateA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Apply status filter
      const filtered = statusFilter === 'all'
        ? historyItems
        : historyItems.filter((item) => item.status.toLowerCase() === statusFilter.toLowerCase());

      setHistory(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' };
      case 'REJECTED':
        return { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

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
            Approval History
          </h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            {history.length} {history.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="all">All Statuses</option>
            <option value="published">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
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
            Loading history...
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

        {!loading && !error && history.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-sm)' }}>
              No approval history
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Approved and rejected items will appear here
            </p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {history.map((item) => {
              const statusColors = getStatusColor(item.status);
              const date = item.approvedAt ? new Date(item.approvedAt) : new Date(item.createdAt);
              const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
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
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-md)',
                          marginBottom: 'var(--spacing-xs)',
                        }}
                      >
                        <Link
                          href={`/skills/${item.skill.id}`}
                          style={{
                            fontSize: '1.125rem',
                            fontWeight: 600,
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {item.skill.name}
                        </Link>
                        <span
                          style={{
                            background: statusColors.bg,
                            color: statusColors.text,
                            padding: '2px var(--spacing-sm)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.status.toLowerCase()}
                        </span>
                        <span
                          style={{
                            background: 'var(--color-surface-secondary)',
                            color: 'var(--color-text-secondary)',
                            padding: '2px var(--spacing-sm)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                          }}
                        >
                          v{item.version}
                        </span>
                        {item.skill.category && (
                          <span
                            style={{
                              background: 'var(--color-surface-tertiary)',
                              color: 'var(--color-text-secondary)',
                              padding: '2px var(--spacing-sm)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {item.skill.category}
                          </span>
                        )}
                      </div>
                      {item.changeNotes && (
                        <p
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.875rem',
                            marginTop: 'var(--spacing-xs)',
                          }}
                        >
                          {item.changeNotes}
                        </p>
                      )}
                      {item.rejectionReason && (
                        <div
                          style={{
                            marginTop: 'var(--spacing-sm)',
                            padding: 'var(--spacing-sm)',
                            background: 'var(--color-danger-bg)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <p
                            style={{
                              color: 'var(--color-danger-text)',
                              fontSize: '0.875rem',
                              margin: 0,
                              fontWeight: 500,
                            }}
                          >
                            Rejection Reason: {item.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 'var(--spacing-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span>
                      Created by {item.createdBy.name || item.createdBy.email}
                      {item.approvedBy && (
                        <>
                          {' • '}
                          {item.status === 'PUBLISHED' ? 'Approved' : 'Rejected'} by{' '}
                          {item.approvedBy.name || item.approvedBy.email}
                        </>
                      )}
                    </span>
                    <span>{formattedDate}</span>
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
