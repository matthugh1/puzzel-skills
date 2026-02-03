'use client';

import { useState, useEffect } from 'react';

interface SkillFormData {
  name: string;
  description: string;
  category: string;
  tags: string[];
  visibility: 'TEAM' | 'ORG';
  toolId?: string;
}

interface Tool {
  id: string;
  name: string;
  description: string;
}

interface SkillFormProps {
  initialData?: Partial<SkillFormData>;
  onSubmit: (data: SkillFormData) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  categories?: string[];
}

export function SkillForm({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  categories = [],
}: SkillFormProps) {
  const [formData, setFormData] = useState<SkillFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    tags: initialData?.tags || [],
    visibility: initialData?.visibility || 'ORG',
    toolId: initialData?.toolId || '',
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoadingTools(true);
      const response = await fetch('/api/tools');
      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);
      }
    } catch (err) {
      console.error('Error loading tools:', err);
    } finally {
      setLoadingTools(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (newErrors.name) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Always include toolId in submission - use null if empty so API knows to remove it
      const submitData = {
        ...formData,
        toolId: formData.toolId && formData.toolId.trim().length > 0 ? formData.toolId : null,
      };
      console.log('[SkillForm] Submitting form data:', submitData);
      await onSubmit(submitData);
      console.log('[SkillForm] Form submitted successfully');
    } catch (error) {
      console.error('[SkillForm] Form submission error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface)',
              border: errors.name
                ? '1px solid var(--color-danger)'
                : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.outline = 'none';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-10)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = errors.name
                ? 'var(--color-danger)'
                : 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {errors.name && (
            <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.875rem', color: 'var(--color-danger)' }}>
              {errors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="description"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
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
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <label
              htmlFor="category"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tags */}
        <div>
          <label
            htmlFor="tags"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Tags
          </label>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Add a tag and press Enter"
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: tagInput.trim() ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                color: tagInput.trim() ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: tagInput.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-body)',
              }}
            >
              Add
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1rem',
                    }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tool Selection */}
        <div>
          <label
            htmlFor="toolId"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Tool (Optional)
          </label>
          <select
            id="toolId"
            value={formData.toolId || ''}
            onChange={(e) => {
              const value = e.target.value;
              // Keep empty string if "None" is selected, convert to undefined for API
              setFormData({ ...formData, toolId: value === '' ? undefined : value });
            }}
            style={{
              width: '100%',
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '1rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}
          >
            <option value="">None (LLM-based skill)</option>
            {loadingTools ? (
              <option disabled>Loading tools...</option>
            ) : (
              tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name} - {tool.description}
                </option>
              ))
            )}
          </select>
          {formData.toolId && (
            <p
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
              }}
            >
              This skill will use the selected tool instead of calling an LLM.
            </p>
          )}
        </div>

        {/* Visibility */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Visibility
          </label>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="visibility"
                value="TEAM"
                checked={formData.visibility === 'TEAM'}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'TEAM' | 'ORG' })}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Team</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="visibility"
                value="ORG"
                checked={formData.visibility === 'ORG'}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'TEAM' | 'ORG' })}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Organization</span>
            </label>
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
          <button
            type="submit"
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
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
