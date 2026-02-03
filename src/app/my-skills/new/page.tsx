'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import { SkillForm } from '@/components/forms/SkillForm';
import { VersionForm } from '@/components/forms/VersionForm';

export default function CreateSkillPage() {
  const router = useRouter();
  const [step, setStep] = useState<'metadata' | 'content'>('metadata');
  const [metadata, setMetadata] = useState<{
    name: string;
    description: string;
    category: string;
    tags: string[];
    visibility: 'TEAM' | 'ORG';
    toolId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMetadataSubmit = async (data: {
    name: string;
    description: string;
    category: string;
    tags: string[];
    visibility: 'TEAM' | 'ORG';
    toolId?: string;
  }) => {
    setMetadata(data);
    setStep('content');
  };

  const handleContentSubmit = async (data: { content: string; changeNotes: string }) => {
    if (!metadata) return;

    setLoading(true);
    setError(null);

    try {
      // Clean up metadata: remove null/empty optional fields
      const payload: Record<string, unknown> = {
        name: metadata.name.trim(),
        visibility: metadata.visibility,
        content: data.content.trim(),
        tags: metadata.tags || [],
      };

      // Only include optional fields if they have actual values
      if (metadata.description && metadata.description.trim()) {
        payload.description = metadata.description.trim();
      }
      if (metadata.category && metadata.category.trim()) {
        payload.category = metadata.category.trim();
      }
      // toolId might be null from SkillForm - only include if it's a non-empty string
      if (metadata.toolId && typeof metadata.toolId === 'string' && metadata.toolId.trim()) {
        payload.toolId = metadata.toolId.trim();
      }

      console.log('[CreateSkillPage] Sending payload:', JSON.stringify(payload, null, 2));

      const response = await skillsApi.create(payload);

      router.push(`/my-skills/${(response.skill as { id: string }).id}`);
    } catch (err: unknown) {
      // Try to extract validation error details
      let errorMessage = 'Failed to create skill';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check if error has details property (from API response)
        const errorObj = err as Error & { details?: unknown };
        if (errorObj.details) {
          console.error('Validation errors:', errorObj.details);
          errorMessage += `: ${JSON.stringify(errorObj.details)}`;
        }
      }
      setError(errorMessage);
      console.error('Error creating skill:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            margin: 0,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
          }}
        >
          Create New Skill
        </h1>
      </header>

      <main className="page-content">
        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {step === 'metadata' && (
          <div style={{ maxWidth: '800px' }}>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: 'var(--spacing-lg)',
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              Step 1: Skill Metadata
            </h2>
            <SkillForm
              onSubmit={handleMetadataSubmit}
              onCancel={() => router.back()}
              submitLabel="Next: Add Prompt"
            />
          </div>
        )}

        {step === 'content' && metadata && (
          <div style={{ maxWidth: '800px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-lg)',
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
                Step 2: Prompt Content
              </h2>
              <button
                onClick={() => setStep('metadata')}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                ← Back
              </button>
            </div>
            <VersionForm
              onSubmit={handleContentSubmit}
              onCancel={() => router.back()}
              submitLabel={loading ? 'Creating...' : 'Create Skill'}
              requireChangeNotes={false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
