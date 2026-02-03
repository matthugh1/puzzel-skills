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
                fontSize: '2.25rem',
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
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: copied ? 'var(--color-success)' : 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
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
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
          }}
        >
          {skill.category && (
            <div>
              <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
                Category:
              </span>
              <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                {skill.category}
              </span>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Owner:
            </span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
              {skill.owner.name || skill.owner.email}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Status:
            </span>
            <span
              style={{
                color: 'var(--color-text)',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {skill.status.toLowerCase().replace('_', ' ')}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-muted)', marginRight: 'var(--spacing-xs)' }}>
              Visibility:
            </span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
              {skill.visibility}
            </span>
          </div>
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
                fontSize: '0.875rem',
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
