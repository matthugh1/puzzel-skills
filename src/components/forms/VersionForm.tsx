'use client';

import { useState } from 'react';
import { PromptEditor } from '../editor/PromptEditor';
import { VariableHelper } from '../editor/VariableHelper';

interface VersionFormProps {
  initialContent?: string;
  onSubmit: (data: { content: string; changeNotes: string }) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  requireChangeNotes?: boolean;
  onContentChange?: (content: string) => void;
}

export function VersionForm({
  initialContent = '',
  onSubmit,
  onCancel,
  submitLabel = 'Save Version',
  requireChangeNotes = true,
  onContentChange,
}: VersionFormProps) {
  const [content, setContent] = useState(initialContent);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
  };
  const [changeNotes, setChangeNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract existing variables from content
  const existingVariables = Array.from(
    new Set(
      (content.match(/\{\{(\w+)\}\}/g) || []).map((match) => match.replace(/[{}]/g, ''))
    )
  );

  const handleInsertVariable = (variableName: string) => {
    // Find the active textarea (the prompt editor)
    const textareas = document.querySelectorAll('textarea');
    const promptTextarea = Array.from(textareas).find(
      (ta) => ta.getAttribute('placeholder')?.includes('prompt') || ta.value === content
    ) || textareas[0];

    if (!promptTextarea) {
      // Fallback: just append to content
      setContent(content + `{{${variableName}}}`);
      return;
    }

    const start = promptTextarea.selectionStart || 0;
    const end = promptTextarea.selectionEnd || 0;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const variable = `{{${variableName}}}`;

    const newContent = before + variable + after;
    setContent(newContent);

    // Set cursor position after inserted variable
    setTimeout(() => {
      promptTextarea.focus();
      promptTextarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!content.trim()) {
      newErrors.content = 'Content is required';
    }
    if (requireChangeNotes && !changeNotes.trim()) {
      newErrors.changeNotes = 'Change notes are required for new versions';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ content, changeNotes });
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Variable Helper */}
        <VariableHelper onInsert={handleInsertVariable} existingVariables={existingVariables} />

        {/* Content Editor */}
        <div>
          <label
            htmlFor="content"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Prompt Content <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <PromptEditor value={content} onChange={handleContentChange} minHeight="300px" />
          {errors.content && (
            <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
              {errors.content}
            </p>
          )}
        </div>

        {/* Change Notes */}
        <div>
          <label
            htmlFor="changeNotes"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Change Notes {requireChangeNotes && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          </label>
          <textarea
            id="changeNotes"
            value={changeNotes}
            onChange={(e) => setChangeNotes(e.target.value)}
            placeholder="Describe what changed in this version..."
            rows={3}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface)',
              border: errors.changeNotes
                ? '1px solid var(--color-danger)'
                : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              resize: 'vertical',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.outline = 'none';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = errors.changeNotes
                ? 'var(--color-danger)'
                : 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {errors.changeNotes && (
            <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
              {errors.changeNotes}
            </p>
          )}
        </div>

        {/* Error message */}
        {errors.submit && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: isSubmitting ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
              color: isSubmitting ? 'var(--color-text-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
