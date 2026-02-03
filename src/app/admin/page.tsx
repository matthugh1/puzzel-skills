'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import { StatsCard } from '@/components/admin/StatsCard';

interface DashboardStats {
  skills: {
    total: number;
    draft: number;
    pending: number;
    published: number;
    archived: number;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  approvals: {
    pending: number;
    approvedThisWeek: number;
    rejectedThisWeek: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string;
    user: { id: string; email: string; name: string | null };
    createdAt: Date | string;
  }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');
    if (!token) {
      sessionStorage.setItem('returnTo', '/admin');
      router.push('/login');
      return;
    }

    loadStats();
  }, [router]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<DashboardStats>('/api/admin/stats');
      setStats(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load stats';
      setError(errorMessage);
      console.error('Error loading stats:', err);
      
      // If unauthorized, redirect to login
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        sessionStorage.setItem('returnTo', '/admin');
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
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
          Admin Dashboard
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
            Loading dashboard...
          </div>
        )}

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

        {!loading && !error && stats && (
          <>
            {/* Stats Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-xl)',
              }}
            >
              <StatsCard
                title="Total Skills"
                value={stats.skills.total}
                subtitle={`${stats.skills.published} published`}
              />
              <StatsCard
                title="Pending Approvals"
                value={stats.approvals.pending}
                subtitle="Awaiting review"
              />
              <StatsCard
                title="Total Users"
                value={stats.users.total}
                subtitle={`${Object.keys(stats.users.byRole).length} roles`}
              />
              <StatsCard
                title="This Week"
                value={stats.approvals.approvedThisWeek}
                subtitle={`${stats.approvals.rejectedThisWeek} rejected`}
              />
            </div>

            {/* Skills Breakdown */}
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: 'var(--spacing-lg)',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text)',
                }}
              >
                Skills by Status
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--spacing-md)',
                }}
              >
                <StatsCard title="Draft" value={stats.skills.draft} />
                <StatsCard title="Pending" value={stats.skills.pending} />
                <StatsCard title="Published" value={stats.skills.published} />
                <StatsCard title="Archived" value={stats.skills.archived} />
              </div>
            </div>

            {/* Users by Role */}
            {Object.keys(stats.users.byRole).length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                <h2
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-lg)',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-text)',
                  }}
                >
                  Users by Role
                </h2>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  {Object.entries(stats.users.byRole).map(([role, count]) => (
                    <StatsCard
                      key={role}
                      title={role.charAt(0).toUpperCase() + role.slice(1)}
                      value={count}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div>
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  marginBottom: 'var(--spacing-lg)',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text)',
                }}
              >
                Recent Activity
              </h2>
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: 'var(--color-surface-secondary)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <th
                        style={{
                          padding: 'var(--spacing-md)',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Action
                      </th>
                      <th
                        style={{
                          padding: 'var(--spacing-md)',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        User
                      </th>
                      <th
                        style={{
                          padding: 'var(--spacing-md)',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Resource
                      </th>
                      <th
                        style={{
                          padding: 'var(--spacing-md)',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentActivity.map((activity) => {
                      const date = new Date(activity.createdAt);
                      const formattedDate = date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr
                          key={activity.id}
                          style={{
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}
                          >
                            {activity.action}
                          </td>
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {activity.user.name || activity.user.email}
                          </td>
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {activity.resourceType}:{activity.resourceId.slice(0, 8)}...
                          </td>
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text-muted)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {formattedDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
