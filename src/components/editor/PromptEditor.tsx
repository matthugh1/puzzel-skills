'use client';

import { useState, useRef, useEffect } from 'react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function PromptEditor({
  value,
  onChange,
  placeholder = 'Enter your prompt here...',
  minHeight = '400px',
}: PromptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [characterCount, setCharacterCount] = useState(value.length);

  useEffect(() => {
    setCharacterCount(value.length);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setCharacterCount(newValue.length);
  };

  // Expose insertVariable via a callback prop pattern instead
  useEffect(() => {
    // This will be handled by the parent component via the onChange callback
  }, [value]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight,
          padding: 'var(--spacing-md)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          fontFamily: 'var(--font-mono, monospace)',
          lineHeight: 1.6,
          color: 'var(--color-text)',
          resize: 'vertical',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary)';
          e.currentTarget.style.outline = 'none';
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-10)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 'var(--spacing-sm)',
          right: 'var(--spacing-md)',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface)',
          padding: '2px var(--spacing-xs)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {characterCount.toLocaleString()} characters
      </div>
    </div>
  );
}

// Export a way to get the insertVariable function
export function usePromptEditor() {
  return {
    insertVariable: (ref: React.RefObject<HTMLTextAreaElement>, variableName: string) => {
      if (ref.current && (ref.current as any).insertVariable) {
        (ref.current as any).insertVariable(variableName);
      }
    },
  };
}
