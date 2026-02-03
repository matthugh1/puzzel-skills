'use client';

interface VersionDiffProps {
  oldVersion: string;
  newVersion: string;
  oldVersionNumber: number;
  newVersionNumber: number;
}

export function VersionDiff({
  oldVersion,
  newVersion,
  oldVersionNumber,
  newVersionNumber,
}: VersionDiffProps) {
  // Simple line-by-line diff
  const oldLines = oldVersion.split('\n');
  const newLines = newVersion.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  const diffLines: Array<{
    type: 'added' | 'removed' | 'unchanged';
    oldLine?: string;
    newLine?: string;
    lineNumber: number;
  }> = [];

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      diffLines.push({ type: 'added', newLine, lineNumber: i + 1 });
    } else if (newLine === undefined) {
      diffLines.push({ type: 'removed', oldLine, lineNumber: i + 1 });
    } else if (oldLine === newLine) {
      diffLines.push({ type: 'unchanged', oldLine, newLine, lineNumber: i + 1 });
    } else {
      diffLines.push({ type: 'removed', oldLine, lineNumber: i + 1 });
      diffLines.push({ type: 'added', newLine, lineNumber: i + 1 });
    }
  }

  const getLineStyle = (type: string) => {
    switch (type) {
      case 'added':
        return {
          background: 'var(--color-success-bg)',
          color: 'var(--color-success-text)',
          borderLeft: '3px solid var(--color-success)',
        };
      case 'removed':
        return {
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger-text)',
          borderLeft: '3px solid var(--color-danger)',
        };
      default:
        return {
          background: 'transparent',
          color: 'var(--color-text)',
        };
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
          }}
        >
          Version Comparison
        </h3>
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          v{oldVersionNumber} → v{newVersionNumber}
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {diffLines.map((line, index) => (
            <div
              key={index}
              style={{
                display: 'contents',
              }}
            >
              <div
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text-muted)',
                  textAlign: 'right',
                  borderRight: '1px solid var(--color-border)',
                  ...getLineStyle(line.type),
                }}
              >
                {line.lineNumber}
              </div>
              <div
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  ...getLineStyle(line.type),
                }}
              >
                {line.type === 'removed' && line.oldLine && (
                  <span style={{ textDecoration: 'line-through' }}>{line.oldLine}</span>
                )}
                {line.type === 'added' && line.newLine && (
                  <span style={{ fontWeight: 500 }}>{line.newLine}</span>
                )}
                {line.type === 'unchanged' && line.newLine}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 'var(--spacing-md)',
          display: 'flex',
          gap: 'var(--spacing-md)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger)',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>Removed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success)',
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>Added</span>
        </div>
      </div>
    </div>
  );
}
