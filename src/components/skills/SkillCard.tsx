'use client';

import Link from 'next/link';

interface SkillCardProps {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  owner: { name: string | null; email: string };
  updatedAt: Date | string;
}

export function SkillCard({
  id,
  name,
  description,
  category,
  tags,
  owner,
  updatedAt,
}: SkillCardProps) {
  const date = new Date(updatedAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link href={`/skills/${id}`}>
      <div
        className="skill-card"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: 'var(--spacing-lg)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {name}
            </h3>
            {category && (
              <span
                style={{
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--color-text-secondary)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {category}
              </span>
            )}
          </div>

          {description && (
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                marginBottom: 'var(--spacing-md)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}

          {tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--spacing-xs)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'var(--color-surface-tertiary)',
                    color: 'var(--color-text-secondary)',
                    padding: '2px var(--spacing-sm)',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                  }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '0.75rem',
                  }}
                >
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--spacing-md)',
            marginTop: 'var(--spacing-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
          }}
        >
          <span>{owner.name || owner.email}</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </Link>
  );
}
