'use client';

interface Version {
  id: string;
  version: number;
  changeNotes: string | null;
  status: string;
  createdAt: Date | string;
  createdBy: { name: string | null; email: string };
  approvedBy: { name: string | null; email: string } | null;
  approvedAt: Date | string | null;
}

interface VersionHistoryProps {
  versions: Version[];
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return '#d1fae5';
      case 'PENDING_APPROVAL':
        return '#fef3c7';
      case 'REJECTED':
        return '#fee2e2';
      default:
        return 'var(--color-surface-secondary)';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return '#065f46';
      case 'PENDING_APPROVAL':
        return '#92400e';
      case 'REJECTED':
        return '#991b1b';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  return (
    <div>
      <h3
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          marginBottom: 'var(--spacing-lg)',
          fontFamily: 'var(--font-display)',
        }}
      >
        Version History
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {versions.map((version) => {
          const date = new Date(version.createdAt);
          const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={version.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-md)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--spacing-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontSize: '1rem',
                    }}
                  >
                    Version {version.version}
                  </span>
                  <span
                    style={{
                      background: getStatusColor(version.status),
                      color: getStatusTextColor(version.status),
                      padding: '2px var(--spacing-sm)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                    }}
                  >
                    {version.status.replace('_', ' ')}
                  </span>
                </div>
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  {formattedDate}
                </span>
              </div>

              {version.changeNotes && (
                <p
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.875rem',
                    marginTop: 'var(--spacing-sm)',
                    marginBottom: 0,
                  }}
                >
                  {version.changeNotes}
                </p>
              )}

              <div
                style={{
                  marginTop: 'var(--spacing-sm)',
                  paddingTop: 'var(--spacing-sm)',
                  borderTop: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                Created by {version.createdBy.name || version.createdBy.email}
                {version.approvedBy && (
                  <>
                    {' • '}
                    Approved by {version.approvedBy.name || version.approvedBy.email}
                    {version.approvedAt && (
                      <>
                        {' on '}
                        {new Date(version.approvedAt).toLocaleDateString()}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
