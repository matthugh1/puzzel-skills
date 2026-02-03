'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { skillsApi } from '@/lib/api-client';
import Link from 'next/link';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: string;
  updatedAt: Date | string;
  owner?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function MySkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Load user first
      let userId: string | null = null;
      try {
        const userResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.user) {
            userId = userData.user.id;
            setCurrentUserId(userId);
          }
        }
      } catch (err) {
        console.error('Error loading user:', err);
      }

      // Then load skills with the userId
      await loadSkills(userId);
    };

    loadData();
  }, []);

  const loadSkills = async (userIdOverride?: string | null) => {
    try {
      setLoading(true);
      setError(null);
      // Don't filter by status - API will return user's own skills + published when authenticated
      const response = await skillsApi.list();
      const allSkills = response.skills as Skill[];
      
      // Use provided userId or currentUserId from state
      const userId = userIdOverride ?? currentUserId;
      
      if (userId) {
        const mySkills = allSkills.filter(
          (skill) => skill.owner?.id === userId
        );
        setSkills(mySkills);
      } else {
        // If no user, show empty (shouldn't happen on My Skills page)
        setSkills([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
      console.error('Error loading skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' };
      case 'PENDING_APPROVAL':
        return { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' };
      case 'DRAFT':
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)' };
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this skill?')) return;

    try {
      await skillsApi.archive(id);
      loadSkills();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive skill');
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
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            My Skills
          </h1>
          <Link
            href="/my-skills/new"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
            }}
          >
            + New Skill
          </Link>
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
            Loading skills...
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

        {!loading && !error && skills.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-md)' }}>
              No skills yet
            </p>
            <Link
              href="/my-skills/new"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
                fontFamily: 'var(--font-body)',
              }}
            >
              Create Your First Skill
            </Link>
          </div>
        )}

        {!loading && !error && skills.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 'var(--spacing-lg)',
            }}
          >
            {skills.map((skill) => {
              const statusColors = getStatusColor(skill.status);
              return (
                <div
                  key={skill.id}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--spacing-sm)',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 600,
                          margin: 0,
                          fontFamily: 'var(--font-display)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {skill.name}
                      </h3>
                      <span
                        style={{
                          background: statusColors.bg,
                          color: statusColors.text,
                          padding: '2px var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}
                      >
                        {skill.status.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>

                    {skill.description && (
                      <p
                        style={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '0.875rem',
                          marginBottom: 'var(--spacing-sm)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {skill.description}
                      </p>
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 'var(--spacing-md)',
                      display: 'flex',
                      gap: 'var(--spacing-sm)',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Link
                      href={`/my-skills/${skill.id}`}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        background: 'var(--color-surface-secondary)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        textDecoration: 'none',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      View
                    </Link>
                    <Link
                      href={`/my-skills/${skill.id}/edit`}
                      style={{
                        padding: 'var(--spacing-xs) var(--spacing-md)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.875rem',
                        textDecoration: 'none',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
