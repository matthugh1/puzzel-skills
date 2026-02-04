'use client';

import { useState, useEffect } from 'react';
import { workspacesApi } from '@/lib/api-client';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  versions: Array<{
    id: string;
    version: number;
    inputContract: unknown;
    outputContract: unknown;
  }>;
}

interface SkillsSidebarProps {
  workspaceId: string;
  onSkillSelect: (skillId: string) => void;
}

export function SkillsSidebar({ workspaceId, onSkillSelect }: SkillsSidebarProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSkills();
  }, [workspaceId]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workspacesApi.getSkills(workspaceId);
      setSkills(response.skills as Skill[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
      console.error('Error loading skills:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter((skill) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      skill.name.toLowerCase().includes(query) ||
      skill.description?.toLowerCase().includes(query) ||
      skill.category?.toLowerCase().includes(query) ||
      skill.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: 'var(--spacing-md)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            margin: 0,
            marginBottom: 'var(--spacing-sm)',
            color: 'var(--color-text)',
          }}
        >
          Skills
        </h3>
        <input
          type="text"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text)',
            background: 'var(--color-background)',
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-sm)',
        }}
      >
        {loading && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            Loading skills...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && filteredSkills.length === 0 && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            {searchQuery ? 'No skills found' : 'No skills available'}
          </div>
        )}

        {!loading && !error && filteredSkills.map((skill) => (
          <div
            key={skill.id}
            onClick={() => onSkillSelect({ id: skill.id, name: skill.name })}
            style={{
              padding: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-sm)',
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-background)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
                fontSize: '0.875rem',
              }}
            >
              {skill.name}
            </div>
            {skill.description && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                {skill.description}
              </div>
            )}
            {skill.category && (
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.125rem 0.5rem',
                  background: 'var(--color-primary)',
                  color: 'white',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  marginTop: 'var(--spacing-xs)',
                }}
              >
                {skill.category}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
