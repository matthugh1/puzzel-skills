'use client';

import { useState } from 'react';
import { VersionHistory } from './VersionHistory';

interface SkillDetailProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    tags: string[];
    status: string;
    visibility: string;
    owner: { id: string; name: string | null; email: string };
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  versions: Array<{
    id: string;
    version: number;
    changeNotes: string | null;
    status: string;
    createdAt: Date | string;
    createdBy: { name: string | null; email: string };
    approvedBy: { name: string | null; email: string } | null;
    approvedAt: Date | string | null;
  }>;
  latestPublished: {
    id: string;
    version: number;
    content: string;
    changeNotes: string | null;
  } | null;
}

export function SkillDetail({ skill, versions, latestPublished }: SkillDetailProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async () => {
    if (!latestPublished) return;

    try {
      await navigator.clipboard.writeText(latestPublished.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const infoItems = [
    skill.category ? { label: 'Category', value: skill.category } : null,
    { label: 'Owner', value: skill.owner.name || skill.owner.email },
    { label: 'Status', value: skill.status.toLowerCase().replace('_', ' ') },
    { label: 'Visibility', value: skill.visibility },
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                marginBottom: 'var(--spacing-md)',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              {skill.name}
            </h1>
            {skill.description && (
              <p
                style={{
                  fontSize: '1.125rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: 'var(--spacing-lg)',
                }}
              >
                {skill.description}
              </p>
            )}
          </div>
          {latestPublished && (
            <button
              onClick={handleCopyPrompt}
              className="btn"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: copied ? 'var(--color-success)' : 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: copied ? '1px solid var(--color-success)' : '1px solid var(--color-primary)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = 'var(--color-primary-dark)';
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = 'var(--color-primary)';
                }
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Prompt'}
            </button>
          )}
        </div>

        {/* Metadata */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0,
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8125rem',
            border: '1px solid var(--color-border-muted)',
          }}
        >
          {infoItems.map((item, index) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRight:
                  index < infoItems.length - 1
                    ? '1px solid var(--color-border-muted)'
                    : 'none',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{item.label}:</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tags */}
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
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Published Prompt */}
      {latestPublished && (
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Published Prompt (v{latestPublished.version})
            </h2>
          </div>
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-muted)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-lg)',
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                color: 'var(--color-text)',
              }}
            >
              {latestPublished.content}
            </pre>
          </div>
          {latestPublished.changeNotes && (
            <div
              style={{
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <strong>Change Notes:</strong> {latestPublished.changeNotes}
            </div>
          )}
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div>
          <VersionHistory versions={versions} />
        </div>
      )}
    </div>
  );
}
