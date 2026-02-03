'use client';

import { VersionDiff } from '../editor/VersionDiff';

interface ReviewPanelProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    tags: string[];
  };
  version: {
    id: string;
    version: number;
    content: string;
    changeNotes: string | null;
    createdAt: Date | string;
    createdBy: { name: string | null; email: string };
  };
  previousPublishedVersion?: {
    version: number;
    content: string;
  } | null;
}

export function ReviewPanel({
  skill,
  version,
  previousPublishedVersion,
}: ReviewPanelProps) {
  const date = new Date(version.createdAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* Skill Metadata */}
      <div>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: 'var(--spacing-md)',
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
          }}
        >
          {skill.name}
        </h2>
        {skill.description && (
          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-lg)',
              lineHeight: 1.6,
            }}
          >
            {skill.description}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Version:
            </span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>v{version.version}</span>
          </div>
          {skill.category && (
            <div>
              <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
                Category:
              </span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{skill.category}</span>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Submitted by:
            </span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
              {version.createdBy.name || version.createdBy.email}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Submitted:
            </span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{formattedDate}</span>
          </div>
        </div>

        {skill.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-md)',
            }}
          >
            {skill.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: 'var(--color-surface-tertiary)',
                  color: 'var(--color-text-secondary)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Change Notes */}
      {version.changeNotes && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            background: '#fef3c7',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #fbbf24',
          }}
        >
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: 'var(--spacing-xs)',
              color: '#92400e',
            }}
          >
            Change Notes
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
            {version.changeNotes}
          </p>
        </div>
      )}

      {/* Diff View */}
      {previousPublishedVersion ? (
        <div>
          <VersionDiff
            oldVersion={previousPublishedVersion.content}
            newVersion={version.content}
            oldVersionNumber={previousPublishedVersion.version}
            newVersionNumber={version.version}
          />
        </div>
      ) : (
        <div>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              marginBottom: 'var(--spacing-md)',
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Version Content
          </h3>
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-lg)',
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: 'var(--color-text)',
              }}
            >
              {version.content}
            </pre>
          </div>
          <p
            style={{
              marginTop: 'var(--spacing-sm)',
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
              fontStyle: 'italic',
            }}
          >
            This is the first version (no previous version to compare)
          </p>
        </div>
      )}
    </div>
  );
}
