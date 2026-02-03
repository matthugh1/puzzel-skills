'use client';

import { useState } from 'react';

interface VariableHelperProps {
  onInsert: (variableName: string) => void;
  existingVariables?: string[];
}

export function VariableHelper({ onInsert, existingVariables = [] }: VariableHelperProps) {
  const [variableName, setVariableName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleInsert = (name: string) => {
    if (name.trim()) {
      onInsert(name.trim());
      setVariableName('');
      setShowSuggestions(false);
    }
  };

  const filteredSuggestions = existingVariables.filter((v) =>
    v.toLowerCase().includes(variableName.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <input
          type="text"
          value={variableName}
          onChange={(e) => {
            setVariableName(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Variable name (e.g., document, user_input)"
          style={{
            flex: 1,
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
          }}
        />
        <button
          onClick={() => handleInsert(variableName)}
          disabled={!variableName.trim()}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: variableName.trim()
              ? 'var(--color-primary)'
              : 'var(--color-surface-secondary)',
            color: variableName.trim() ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: variableName.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-body)',
          }}
        >
          Insert
        </button>
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 10,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {filteredSuggestions.map((variable) => (
            <button
              key={variable}
              onClick={() => handleInsert(variable)}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-mono, monospace)',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      )}

      {existingVariables.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Existing variables:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
            {existingVariables.map((variable) => (
              <button
                key={variable}
                onClick={() => handleInsert(variable)}
                style={{
                  padding: '2px var(--spacing-sm)',
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono, monospace)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-primary)';
                  e.currentTarget.style.color = 'var(--color-on-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-secondary)';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                {variable}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
