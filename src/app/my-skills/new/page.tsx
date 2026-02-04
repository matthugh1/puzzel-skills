'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import { SkillForm } from '@/components/forms/SkillForm';
import { VersionForm } from '@/components/forms/VersionForm';

interface User {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

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
  const [prefilledContent, setPrefilledContent] = useState<string | null>(null);
  const [prefilledContracts, setPrefilledContracts] = useState<{
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [fromPrompt, setFromPrompt] = useState(false);

  useEffect(() => {
    // Fetch user info to check permissions
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error loading user:', err);
      }
    };
    loadUser();

    // Check if we have a skill proposal from prompt
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('fromPrompt') === 'true') {
        setFromPrompt(true);
      }

      const proposalJson = sessionStorage.getItem('skillProposal');
      if (proposalJson) {
        try {
          const proposal = JSON.parse(proposalJson);
          // Pre-fill metadata
          setMetadata({
            name: proposal.name || '',
            description: proposal.description || '',
            category: proposal.category || '',
            tags: proposal.tags || [],
            visibility: 'ORG', // Default
          });
          // Pre-fill content
          if (proposal.content) {
            setPrefilledContent(proposal.content);
          }
          // Pre-fill contracts
          if (proposal.inputContract || proposal.outputContract) {
            setPrefilledContracts({
              inputContract: proposal.inputContract || null,
              outputContract: proposal.outputContract || null,
            });
          }
          // Clear the proposal from sessionStorage
          sessionStorage.removeItem('skillProposal');
          // If we have content, skip to content step
          if (proposal.content) {
            setStep('content');
          }
        } catch (err) {
          console.error('Error parsing skill proposal:', err);
          setError('Failed to load skill proposal. Please try again.');
        }
      }
    }
  }, []);

  const canPublish = user?.permissions.includes('skills:approve') ?? false;

  const handlePublish = async (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => {
    if (!metadata) return;

    setPublishLoading(true);
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
      if (metadata.toolId && typeof metadata.toolId === 'string' && metadata.toolId.trim()) {
        payload.toolId = metadata.toolId.trim();
      }
      if (data.inputContract) {
        payload.inputContract = data.inputContract;
      }
      if (data.outputContract) {
        payload.outputContract = data.outputContract;
      }

      // Create the skill
      const response = await skillsApi.create(payload);
      const skillId = (response.skill as { id: string }).id;

      // Get the created version (should be version 1)
      const versionsResponse = await skillsApi.getVersions(skillId);
      const versions = versionsResponse.versions as Array<{ id: string; version: number; status: string }>;
      const draftVersion = versions.find((v) => v.status === 'DRAFT');

      if (!draftVersion) {
        throw new Error('No draft version found after creation');
      }

      // Submit for approval
      await skillsApi.submitForApproval(skillId, draftVersion.id);

      // If user has approve permission, auto-approve
      if (canPublish) {
        await skillsApi.approve(skillId, draftVersion.id, 'Auto-approved on publish');
      }

      router.push(`/my-skills/${skillId}`);
    } catch (err: unknown) {
      let errorMessage = 'Failed to publish skill';
      if (err instanceof Error) {
        errorMessage = err.message;
        const errorObj = err as Error & { details?: unknown };
        if (errorObj.details) {
          errorMessage += `: ${JSON.stringify(errorObj.details)}`;
        }
      }
      setError(errorMessage);
      console.error('Error publishing skill:', err);
    } finally {
      setPublishLoading(false);
    }
  };

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

  const handleContentSubmit = async (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => {
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
      if (data.inputContract) {
        payload.inputContract = data.inputContract;
      }
      if (data.outputContract) {
        payload.outputContract = data.outputContract;
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
        {fromPrompt && prefilledContent && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-info-bg)',
              color: 'var(--color-info-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Skill generated from prompt!</strong> Review and adjust the fields below, then create your skill.
          </div>
        )}
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
              initialData={metadata || undefined}
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
              initialContent={prefilledContent || ''}
              initialInputContract={prefilledContracts?.inputContract || null}
              initialOutputContract={prefilledContracts?.outputContract || null}
              onSubmit={handleContentSubmit}
              onCancel={() => router.back()}
              submitLabel={loading ? 'Creating...' : 'Create Skill'}
              requireChangeNotes={false}
              onPublish={handlePublish}
              publishLabel={publishLoading ? 'Publishing...' : canPublish ? 'Publish' : 'Submit for Approval'}
              showPublishButton={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}
