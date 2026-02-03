'use client';

import Link from 'next/link';

interface ApprovalCardProps {
  skillId: string;
  versionId: string;
  skillName: string;
  skillDescription: string | null;
  category: string | null;
  versionNumber: number;
  submittedAt: Date | string;
  submittedBy: { name: string | null; email: string };
  changeNotes: string | null;
}

export function ApprovalCard({
  skillId,
  versionId,
  skillName,
  skillDescription,
  category,
  versionNumber,
  submittedAt,
  submittedBy,
  changeNotes,
}: ApprovalCardProps) {
  const date = new Date(submittedAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link href={`/approvals/${skillId}/${versionId}`}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
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
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text)',
                }}
              >
                {skillName}
              </h3>
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '2px var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                v{versionNumber}
              </span>
              {category && (
                <span
                  style={{
                    background: 'var(--color-surface-secondary)',
                    color: 'var(--color-text-secondary)',
                    padding: '2px var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                  }}
                >
                  {category}
                </span>
              )}
            </div>
            {skillDescription && (
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.875rem',
                  marginBottom: 'var(--spacing-sm)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {skillDescription}
              </p>
            )}
            {changeNotes && (
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                  marginTop: 'var(--spacing-xs)',
                }}
              >
                Changes: {changeNotes}
              </p>
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
            Submitted by {submittedBy.name || submittedBy.email}
          </span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </Link>
  );
}
