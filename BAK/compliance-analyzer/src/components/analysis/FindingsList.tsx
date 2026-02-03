'use client';

interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category?: string;
  description: string;
  location?: string;
}

interface FindingsListProps {
  findings: Finding[];
  title: string;
}

const severityColors = {
  CRITICAL: { bg: 'var(--color-surface-secondary)', text: 'var(--color-danger)', border: 'var(--color-danger)' },
  HIGH: { bg: 'var(--color-surface-secondary)', text: 'var(--color-warning)', border: 'var(--color-warning)' },
  MEDIUM: { bg: 'var(--color-surface-secondary)', text: 'var(--color-warning)', border: 'var(--color-warning)' },
  LOW: { bg: 'var(--color-surface-secondary)', text: 'var(--color-primary)', border: 'var(--color-primary)' },
  INFO: { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)', border: 'var(--color-border)' },
};

export function FindingsList({ findings, title }: FindingsListProps) {
  if (findings.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--color-surface-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)'
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--spacing-sm)' }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          No {title.toLowerCase()} found
        </p>
      </div>
    );
  }

  // Group by severity
  const grouped = findings.reduce((acc, finding) => {
    if (!acc[finding.severity]) {
      acc[finding.severity] = [];
    }
    acc[finding.severity].push(finding);
    return acc;
  }, {} as Record<string, Finding[]>);

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {title && (
        <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>{title}</h3>
      )}
      {severityOrder.map((severity) => {
        const items = grouped[severity];
        if (!items || items.length === 0) return null;

        const severityColor = severityColors[severity as keyof typeof severityColors];

        return (
          <div key={severity} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${severityColor.border}`,
                fontSize: '0.75rem',
                fontWeight: '500',
                backgroundColor: severityColor.bg,
                color: severityColor.text
              }}
            >
              {severity} ({items.length})
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-md)' }}>
              {items.map((finding, index) => (
                <li key={index} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '500', color: 'var(--color-text)' }}>
                      {finding.category || 'General'}:
                    </span>
                    <span style={{ marginLeft: 'var(--spacing-sm)' }}>{finding.description}</span>
                  </div>
                  {finding.location && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xs)' }}>
                      Location: {finding.location}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
