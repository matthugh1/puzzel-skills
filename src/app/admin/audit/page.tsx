'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  details: Record<string, unknown> | null;
  createdAt: Date | string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    userId: '',
    from: '',
    to: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.offset]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.resourceType) params.set('resourceType', filters.resourceType);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('limit', pagination.limit.toString());
      params.set('offset', pagination.offset.toString());

      const response = await apiRequest<{
        logs: AuditLog[];
        pagination: typeof pagination;
      }>(`/api/audit?${params.toString()}`);
      setLogs(response.logs);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = ['Action', 'Resource Type', 'Resource ID', 'User', 'Date', 'Details'];
    const rows = logs.map((log) => [
      log.action,
      log.resourceType,
      log.resourceId,
      log.user.email,
      new Date(log.createdAt).toISOString(),
      JSON.stringify(log.details || {}),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            Audit Log
          </h1>
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: logs.length === 0 ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
              color: logs.length === 0 ? 'var(--color-text-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--spacing-md)',
          }}
        >
          <input
            type="text"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            placeholder="Filter by action..."
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <select
            value={filters.resourceType}
            onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
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
            <option value="">All Resource Types</option>
            <option value="skill">Skill</option>
            <option value="version">Version</option>
            <option value="user">User</option>
            <option value="auth">Auth</option>
            <option value="mcp">MCP</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            placeholder="From date"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            placeholder="To date"
            style={{
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
            Loading audit logs...
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

        {!loading && !error && (
          <>
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                marginBottom: 'var(--spacing-md)',
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
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: 'var(--spacing-xl)',
                          textAlign: 'center',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const date = new Date(log.createdAt);
                      const formattedDate = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr
                          key={log.id}
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
                            {log.action}
                          </td>
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text-secondary)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {log.resourceType}:{log.resourceId.slice(0, 8)}...
                          </td>
                          <td
                            style={{
                              padding: 'var(--spacing-md)',
                              fontSize: '0.875rem',
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {log.user.name || log.user.email}
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
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Showing {pagination.offset + 1}-
                  {pagination.offset + logs.length} of {pagination.total}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <button
                    onClick={() =>
                      setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })
                    }
                    disabled={pagination.offset === 0}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-md)',
                      background: pagination.offset === 0 ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
                      color: pagination.offset === 0 ? 'var(--color-text-muted)' : 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      cursor: pagination.offset === 0 ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                    disabled={!pagination.hasMore}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-md)',
                      background: !pagination.hasMore ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
                      color: !pagination.hasMore ? 'var(--color-text-muted)' : 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      cursor: !pagination.hasMore ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
