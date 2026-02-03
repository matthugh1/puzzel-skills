'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import { SkillDetail } from '@/components/skills/SkillDetail';
import Link from 'next/link';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: string;
  visibility: string;
  owner: { id: string; name: string | null; email: string };
  createdAt: Date | string;
  updatedAt: Date | string;
  latestPublishedVersion: {
    id: string;
    version: number;
    content: string;
    changeNotes: string | null;
  } | null;
  latestVersion: {
    id: string;
    version: number;
    content: string;
    changeNotes: string | null;
  };
  versions: Array<{
    id: string;
    version: number;
    changeNotes: string | null;
    status: string;
    createdAt: Date | string;
    createdBy: { name: string | null; email: string };
    approvedBy: { name: string | null; email: string } | null;
    approvedAt: Date | string | null;
  }>;
}

export default function ViewMySkillPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSkill();
    }
  }, [id]);

  const loadSkill = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await skillsApi.getById(id);
      setSkill(response.skill as Skill);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skill');
      console.error('Error loading skill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!skill) return;

    const latestDraft = skill.versions.find((v) => v.status === 'DRAFT');
    if (!latestDraft) {
      alert('No draft version to submit');
      return;
    }

    if (!confirm('Submit this version for approval?')) return;

    try {
      await skillsApi.submitForApproval(skill.id, latestDraft.id);
      loadSkill();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit for approval');
    }
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
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
              {skill?.name || 'Skill Details'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            {skill && skill.versions.some((v) => v.status === 'DRAFT') && (
              <button
                onClick={handleSubmitForApproval}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Submit for Approval
              </button>
            )}
            <Link
              href={`/my-skills/${id}/edit`}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
              }}
            >
              Edit
            </Link>
          </div>
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
            Loading skill...
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

        {!loading && !error && skill && (
          <SkillDetail
            skill={skill}
            versions={skill.versions}
            latestPublished={skill.latestPublishedVersion}
          />
        )}
      </main>
    </div>
  );
}
