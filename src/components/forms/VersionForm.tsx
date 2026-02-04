'use client';

import { useState } from 'react';
import { PromptEditor } from '../editor/PromptEditor';
import { VariableHelper } from '../editor/VariableHelper';

interface VersionFormProps {
  initialContent?: string;
  initialInputContract?: Record<string, unknown> | null;
  initialOutputContract?: Record<string, unknown> | null;
  onSubmit: (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  requireChangeNotes?: boolean;
  onContentChange?: (content: string) => void;
  onPublish?: (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => void | Promise<void>;
  publishLabel?: string;
  showPublishButton?: boolean;
}

export function VersionForm({
  initialContent = '',
  initialInputContract = null,
  initialOutputContract = null,
  onSubmit,
  onCancel,
  submitLabel = 'Save Version',
  requireChangeNotes = true,
  onContentChange,
  onPublish,
  publishLabel = 'Publish',
  showPublishButton = false,
}: VersionFormProps) {
  const [content, setContent] = useState(initialContent);
  const [inputContractText, setInputContractText] = useState(
    initialInputContract ? JSON.stringify(initialInputContract, null, 2) : ''
  );
  const [outputContractText, setOutputContractText] = useState(
    initialOutputContract ? JSON.stringify(initialOutputContract, null, 2) : ''
  );

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

  const validateForm = (): {
    isValid: boolean;
    data: {
      content: string;
      changeNotes: string;
      inputContract?: Record<string, unknown> | null;
      outputContract?: Record<string, unknown> | null;
    };
    errors: Record<string, string>;
  } => {
    const newErrors: Record<string, string> = {};
    if (!content.trim()) {
      newErrors.content = 'Content is required';
    }
    if (requireChangeNotes && !changeNotes.trim()) {
      newErrors.changeNotes = 'Change notes are required for new versions';
    }

    let inputContractValue: Record<string, unknown> | null | undefined = undefined;
    let outputContractValue: Record<string, unknown> | null | undefined = undefined;

    if (inputContractText.trim()) {
      try {
        const parsed = JSON.parse(inputContractText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          newErrors.inputContract = 'Input contract must be a JSON object';
        } else {
          inputContractValue = parsed as Record<string, unknown>;
        }
      } catch (error) {
        newErrors.inputContract = 'Input contract must be valid JSON';
      }
    }

    if (outputContractText.trim()) {
      try {
        const parsed = JSON.parse(outputContractText);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          newErrors.outputContract = 'Output contract must be a JSON object';
        } else {
          outputContractValue = parsed as Record<string, unknown>;
        }
      } catch (error) {
        newErrors.outputContract = 'Output contract must be valid JSON';
      }
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      data: {
        content,
        changeNotes,
        inputContract: inputContractValue,
        outputContract: outputContractValue,
      },
      errors: newErrors,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = validateForm();
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(validation.data);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setErrors({});

    const validation = validateForm();
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    if (!onPublish) return;

    setIsSubmitting(true);
    try {
      await onPublish(validation.data);
    } catch (error) {
      console.error('Publish error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to publish' });
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
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-10)';
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

        {/* Contracts */}
        <div
          style={{
            padding: 'var(--spacing-lg)',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                margin: 0,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Skill Contracts (Optional)
            </h3>
            <p
              style={{
                margin: 'var(--spacing-xs) 0 0',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              Define JSON Schema contracts for inputs and outputs. These act as a formal API for the skill.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <label
                htmlFor="inputContract"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Input Contract (JSON)
              </label>
              <textarea
                id="inputContract"
                value={inputContractText}
                onChange={(e) => setInputContractText(e.target.value)}
                rows={6}
                placeholder='{"type":"object","properties":{}}'
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-surface)',
                  border: errors.inputContract
                    ? '1px solid var(--color-danger)'
                    : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                  resize: 'vertical',
                }}
              />
              {errors.inputContract && (
                <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
                  {errors.inputContract}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="outputContract"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Output Contract (JSON)
              </label>
              <textarea
                id="outputContract"
                value={outputContractText}
                onChange={(e) => setOutputContractText(e.target.value)}
                rows={6}
                placeholder='{"type":"object","properties":{}}'
                style={{
                  width: '100%',
                  padding: 'var(--spacing-md)',
                  background: 'var(--color-surface)',
                  border: errors.outputContract
                    ? '1px solid var(--color-danger)'
                    : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)',
                  resize: 'vertical',
                }}
              />
              {errors.outputContract && (
                <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
                  {errors.outputContract}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {errors.submit && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
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
          {showPublishButton && onPublish && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: isSubmitting ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
                color: isSubmitting ? 'var(--color-text-muted)' : 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {isSubmitting ? 'Publishing...' : publishLabel}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: isSubmitting ? 'var(--color-surface-secondary)' : (showPublishButton && onPublish ? 'var(--color-surface-secondary)' : 'var(--color-primary)'),
              color: isSubmitting ? 'var(--color-text-muted)' : (showPublishButton && onPublish ? 'var(--color-text)' : 'var(--color-on-primary)'),
              border: showPublishButton && onPublish ? '1px solid var(--color-border)' : 'none',
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
