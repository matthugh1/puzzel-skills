'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi, apiRequest } from '@/lib/api-client';
import { ReviewPanel } from '@/components/approvals/ReviewPanel';
import { ApprovalActions } from '@/components/approvals/ApprovalActions';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
}

interface Version {
  id: string;
  version: number;
  content: string;
  changeNotes: string | null;
  status: string;
  createdAt: Date | string;
  createdBy: { id: string; name: string | null; email: string };
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.skillId as string;
  const versionId = params.versionId as string;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [previousPublishedVersion, setPreviousPublishedVersion] = useState<{
    version: number;
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (skillId && versionId) {
      loadData();
    }
  }, [skillId, versionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const userResponse = await apiRequest<{ user: { id: string } }>('/api/auth/me');
      setCurrentUserId(userResponse.user.id);

      // Get skill with versions
      const skillResponse = await skillsApi.getById(skillId);
      const skillData = skillResponse.skill as Skill & {
        versions: Version[];
        latestPublishedVersion: { version: number; content: string } | null;
      };

      setSkill(skillData);

      // Find the specific version
      const targetVersion = skillData.versions.find((v) => v.id === versionId);
      if (!targetVersion) {
        setError('Version not found');
        return;
      }

      if (targetVersion.status !== 'PENDING_APPROVAL') {
        setError('This version is not pending approval');
        return;
      }

      setVersion(targetVersion);

      // Get previous published version for diff
      if (skillData.latestPublishedVersion) {
        setPreviousPublishedVersion(skillData.latestPublishedVersion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review data');
      console.error('Error loading review data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (comments?: string) => {
    if (!skill || !version) return;

    setIsSubmitting(true);
    try {
      await skillsApi.approve(skill.id, version.id, comments);
      router.push('/approvals');
    } catch (err) {
      setIsSubmitting(false);
      throw err;
    }
  };

  const handleReject = async (reason: string) => {
    if (!skill || !version) return;

    setIsSubmitting(true);
    try {
      await skillsApi.reject(skill.id, version.id, reason);
      router.push('/approvals');
    } catch (err) {
      setIsSubmitting(false);
      throw err;
    }
  };

  // TODO: Re-enable self-approval prevention in production
  // const canApprove = currentUserId && version?.createdBy.id !== currentUserId;
  const canApprove = true; // Allow self-approval for now

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              padding: 'var(--spacing-sm)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Review Submission
          </h1>
        </div>
      </header>

      <main className="page-content">
        {loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading review data...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && skill && version && (
          <>
            <ReviewPanel
              skill={skill}
              version={version}
              previousPublishedVersion={previousPublishedVersion}
            />
            <ApprovalActions
              onApprove={handleApprove}
              onReject={handleReject}
              isSubmitting={isSubmitting}
              canApprove={canApprove ?? true}
            />
            {!canApprove && (
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              >
                ⚠️ You cannot approve your own submission
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
