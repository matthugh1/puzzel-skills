'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import { SkillDetail } from '@/components/skills/SkillDetail';

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

export default function SkillDetailPage() {
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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
            Skill Details
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
            Loading skill...
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
