'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import { SkillForm } from '@/components/forms/SkillForm';
import { VersionForm } from '@/components/forms/VersionForm';
import { VersionDiff } from '@/components/editor/VersionDiff';

interface User {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  visibility: 'TEAM' | 'ORG';
  versions: Array<{
    id: string;
    version: number;
    content: string;
    changeNotes: string | null;
    status: string;
    metadata?: {
      executorConfig?: {
        toolId?: string;
      };
      inputContract?: Record<string, unknown> | null;
      outputContract?: Record<string, unknown> | null;
    } | null;
  }>;
}

export default function EditSkillPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metadata' | 'version' | 'diff'>('metadata');
  const [newVersionContent, setNewVersionContent] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadSkill();
    }
  }, [id]);

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
  }, []);

  const canPublish = user?.permissions.includes('skills:approve') ?? false;

  const loadSkill = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await skillsApi.getById(id);
      const skillData = response.skill as Skill;
      console.log('[EditSkillPage] Loaded skill:', {
        id: skillData.id,
        name: skillData.name,
        versions: skillData.versions?.length,
        latestVersionMetadata: skillData.versions?.[0]?.metadata,
        toolId: skillData.versions?.[0]?.metadata?.executorConfig?.toolId,
      });
      setSkill(skillData);

      // Load versions
      const versionsResponse = await skillsApi.getVersions(id);
      const versions = versionsResponse.versions as Skill['versions'];
      const updatedSkill = { ...skillData, versions };
      console.log('[EditSkillPage] Loaded versions:', {
        count: versions.length,
        latestVersionId: versions[0]?.id,
        latestVersionMetadata: versions[0]?.metadata,
        toolId: versions[0]?.metadata?.executorConfig?.toolId,
      });
      setSkill(updatedSkill);

      // Set initial content from latest version
      const latestVersion = versions[0];
      if (latestVersion) {
        setNewVersionContent(latestVersion.content);
      } else {
        setNewVersionContent('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill');
      console.error('[EditSkillPage] Error loading skill:', err);
    } finally {
      setLoading(false);
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
    try {
      console.log('[EditSkillPage] Submitting metadata update:', { id, data });
      const result = await skillsApi.update(id, data);
      console.log('[EditSkillPage] Update result:', result);
      console.log('[EditSkillPage] Response skill data:', {
        skill: (result as { skill: unknown }).skill,
        versions: (result as { skill: Skill }).skill?.versions,
        toolId: (result as { skill: Skill }).skill?.versions?.[0]?.metadata?.executorConfig?.toolId,
      });
      // Reload skill to get updated metadata
      await loadSkill();
      // Don't redirect immediately - let user see the updated form
      // router.push(`/my-skills/${id}`);
    } catch (err) {
      console.error('[EditSkillPage] Error updating skill:', err);
      throw err;
    }
  };

  const handleVersionSubmit = async (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => {
    try {
      await skillsApi.createVersion(id, {
        content: data.content,
        changeNotes: data.changeNotes,
        inputContract: data.inputContract || undefined,
        outputContract: data.outputContract || undefined,
      });
      router.push(`/my-skills/${id}`);
    } catch (err) {
      throw err;
    }
  };

  const handlePublish = async (data: {
    content: string;
    changeNotes: string;
    inputContract?: Record<string, unknown> | null;
    outputContract?: Record<string, unknown> | null;
  }) => {
    setPublishLoading(true);
    setError(null);

    try {
      // Create the new version
      const versionResponse = await skillsApi.createVersion(id, {
        content: data.content,
        changeNotes: data.changeNotes,
        inputContract: data.inputContract || undefined,
        outputContract: data.outputContract || undefined,
      });
      const versionId = (versionResponse.version as { id: string }).id;

      // Submit for approval
      await skillsApi.submitForApproval(id, versionId);

      // If user has approve permission, auto-approve
      if (canPublish) {
        await skillsApi.approve(id, versionId, 'Auto-approved on publish');
      }

      router.push(`/my-skills/${id}`);
    } catch (err: unknown) {
      let errorMessage = 'Failed to publish version';
      if (err instanceof Error) {
        errorMessage = err.message;
        const errorObj = err as Error & { details?: unknown };
        if (errorObj.details) {
          errorMessage += `: ${JSON.stringify(errorObj.details)}`;
        }
      }
      setError(errorMessage);
      console.error('Error publishing version:', err);
    } finally {
      setPublishLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>Error:</strong> {error || 'Skill not found'}
          </div>
        </main>
      </div>
    );
  }

  const latestVersion = skill.versions[0];
  const latestPublished = skill.versions.find((v) => v.status === 'PUBLISHED');

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Edit Skill
          </h1>
          <button
            onClick={() => router.back()}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Cancel
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            marginTop: 'var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {['metadata', 'version', 'diff'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'transparent',
                border: 'none',
                borderBottom:
                  activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                color:
                  activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'metadata' ? 'Metadata' : tab === 'version' ? 'New Version' : 'Compare'}
            </button>
          ))}
        </div>
      </header>

      <main className="page-content">
        {activeTab === 'metadata' && (
          <div style={{ maxWidth: '800px' }}>
            <SkillForm
              initialData={{
                name: skill.name,
                description: skill.description || '',
                category: skill.category || '',
                tags: skill.tags,
                visibility: skill.visibility,
                toolId: skill.versions[0]?.metadata?.executorConfig?.toolId || undefined,
              }}
              onSubmit={handleMetadataSubmit}
              onCancel={() => router.back()}
              submitLabel="Save Changes"
            />
          </div>
        )}

        {activeTab === 'version' && (
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
              Create New Version
            </h2>
            {latestVersion && (
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-lg)',
                }}
              >
                Current version: v{latestVersion.version} ({latestVersion.status})
              </p>
            )}
            <VersionForm
              initialContent={latestVersion?.content || ''}
              initialInputContract={latestVersion?.metadata?.inputContract || null}
              initialOutputContract={latestVersion?.metadata?.outputContract || null}
              onSubmit={handleVersionSubmit}
              onCancel={() => router.back()}
              submitLabel="Create Version"
              requireChangeNotes={true}
              onContentChange={setNewVersionContent}
              onPublish={handlePublish}
              publishLabel={publishLoading ? 'Publishing...' : canPublish ? 'Publish' : 'Submit for Approval'}
              showPublishButton={true}
            />
            {newVersionContent && newVersionContent !== latestVersion?.content && (
              <div style={{ marginTop: 'var(--spacing-lg)' }}>
                <button
                  onClick={() => setActiveTab('diff')}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    background: 'var(--color-surface-secondary)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Preview Changes
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'diff' && (
          <div style={{ maxWidth: '1000px' }}>
            {latestPublished && latestVersion ? (
              <VersionDiff
                oldVersion={latestPublished.content}
                newVersion={newVersionContent || latestVersion.content}
                oldVersionNumber={latestPublished.version}
                newVersionNumber={latestVersion.version + 1}
              />
            ) : (
              <p style={{ color: 'var(--color-text-secondary)' }}>
                No published version to compare with. Create a version first.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
