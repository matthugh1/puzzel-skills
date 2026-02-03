'use client';

import { useState, useEffect } from 'react';

interface Skill {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

interface SkillSelectorProps {
  onSkillSelect: (skillId: string, skillName: string) => void;
  selectedSkillId?: string;
  disabled?: boolean;
}

export function SkillSelector({
  onSkillSelect,
  selectedSkillId,
  disabled = false,
}: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/skills');
      const data = await response.json();

      if (data.success && data.data?.skills) {
        setSkills(data.data.skills);
      } else {
        setError(data.error || 'Failed to load skills');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const filteredSkills = skills.filter((skill) =>
    skill.name.toLowerCase().includes(search.toLowerCase()) ||
    skill.description?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <label style={{ 
        display: 'block', 
        fontSize: '0.875rem', 
        fontWeight: '500', 
        color: 'var(--color-text)' 
      }}>
        Select Compliance Skill
      </label>
      {loading ? (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Loading skills...
        </div>
      ) : error ? (
        <div style={{ fontSize: '0.875rem', color: 'var(--color-danger)' }}>
          {error}
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem var(--spacing-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--color-primary-rgb), 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            disabled={disabled}
          />
          <select
            value={selectedSkillId || ''}
            onChange={(e) => {
              const skill = skills.find((s) => s.id === e.target.value);
              if (skill) {
                onSkillSelect(skill.id, skill.name);
              }
            }}
            style={{
              width: '100%',
              padding: '0.75rem var(--spacing-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-primary)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--color-primary-rgb), 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            disabled={disabled}
          >
            <option value="">Select a skill...</option>
            {filteredSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
                {skill.category ? ` (${skill.category})` : ''}
              </option>
            ))}
          </select>
          {selectedSkill && selectedSkill.description && (
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--color-text-secondary)', 
              marginTop: 'var(--spacing-xs)' 
            }}>
              {selectedSkill.description}
            </p>
          )}
        </>
      )}
    </div>
  );
}
