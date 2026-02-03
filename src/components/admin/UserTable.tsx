'use client';

import Link from 'next/link';

interface User {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  createdAt: Date | string;
}

interface UserTableProps {
  users: User[];
  onEdit?: (userId: string) => void;
}

export function UserTable({ users, onEdit }: UserTableProps) {
  return (
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
              Name
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
              Email
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
              Roles
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
              Created
            </th>
            <th
              style={{
                padding: 'var(--spacing-md)',
                textAlign: 'right',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const date = new Date(user.createdAt);
            const formattedDate = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <tr
                key={user.id}
                style={{
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <td
                  style={{
                    padding: 'var(--spacing-md)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {user.name || '-'}
                </td>
                <td
                  style={{
                    padding: 'var(--spacing-md)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {user.email}
                </td>
                <td
                  style={{
                    padding: 'var(--spacing-md)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        style={{
                          background: 'var(--color-surface-secondary)',
                          color: 'var(--color-text-secondary)',
                          padding: '2px var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          textTransform: 'capitalize',
                        }}
                      >
                        {role}
                      </span>
                    ))}
                  </div>
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
                <td
                  style={{
                    padding: 'var(--spacing-md)',
                    textAlign: 'right',
                  }}
                >
                  {onEdit ? (
                    <button
                      onClick={() => onEdit(user.id)}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
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
                      Edit
                    </button>
                  ) : (
                    <Link
                      href={`/admin/users/${user.id}`}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textDecoration: 'none',
                        display: 'inline-block',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
