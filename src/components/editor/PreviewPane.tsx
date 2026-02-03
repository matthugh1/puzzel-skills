'use client';

import { useState } from 'react';

interface PreviewPaneProps {
  prompt: string;
  variables?: Record<string, string>;
}

export function PreviewPane({ prompt, variables = {} }: PreviewPaneProps) {
  const [previewValues, setPreviewValues] = useState<Record<string, string>>(variables);

  // Extract variables from prompt
  const variableNames = Array.from(
    new Set(
      (prompt.match(/\{\{(\w+)\}\}/g) || []).map((match) => match.replace(/[{}]/g, ''))
    )
  );

  // Merge prompt with preview values
  let mergedPrompt = prompt;
  for (const [key, value] of Object.entries(previewValues)) {
    const placeholder = `{{${key}}}`;
    mergedPrompt = mergedPrompt.replace(
      new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      value || `[${key}]`
    );
  }

  // Replace any remaining variables with placeholder
  mergedPrompt = mergedPrompt.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return `[${varName}]`;
  });

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-lg)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          marginBottom: 'var(--spacing-md)',
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text)',
        }}
      >
        Preview
      </h3>

      {variableNames.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-sm)',
            }}
          >
            Test Variables:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {variableNames.map((varName) => (
              <div key={varName}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    marginBottom: '2px',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {varName}:
                </label>
                <input
                  type="text"
                  value={previewValues[varName] || ''}
                  onChange={(e) => {
                    setPreviewValues({
                      ...previewValues,
                      [varName]: e.target.value,
                    });
                  }}
                  placeholder={`Enter value for ${varName}`}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          Merged Prompt:
        </p>
        <pre
          style={{
            margin: 0,
            padding: 'var(--spacing-md)',
            background: 'var(--color-surface-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--color-text)',
            minHeight: '200px',
          }}
        >
          {mergedPrompt}
        </pre>
      </div>
    </div>
  );
}
