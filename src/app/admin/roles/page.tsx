'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<{ roles: Role[] }>('/api/roles');
      setRoles(response.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
      console.error('Error loading roles:', err);
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
          Role Management
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
            Loading roles...
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

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {roles.map((role) => (
              <div
                key={role.id}
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
                  <div>
                    <h3
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        margin: 0,
                        marginBottom: 'var(--spacing-xs)',
                        fontFamily: 'var(--font-display)',
                        color: 'var(--color-text)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {role.name}
                    </h3>
                    {role.description && (
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          margin: 0,
                        }}
                      >
                        {role.description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      background: 'var(--color-surface-secondary)',
                      color: 'var(--color-text-secondary)',
                      padding: 'var(--spacing-xs) var(--spacing-md)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                  </span>
                </div>

                <div>
                  <h4
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-sm)',
                      color: 'var(--color-text)',
                    }}
                  >
                    Permissions ({role.permissions.length})
                  </h4>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-xs)',
                    }}
                  >
                    {role.permissions.map((permission) => (
                      <span
                        key={permission.id}
                        style={{
                          background: 'var(--color-surface-tertiary)',
                          color: 'var(--color-text-secondary)',
                          padding: '2px var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {permission.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
