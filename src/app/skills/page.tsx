'use client';

import { useEffect, useState, useMemo } from 'react';
import { skillsApi } from '@/lib/api-client';
import { SkillCard } from '@/components/skills/SkillCard';
import { SkillSearch } from '@/components/skills/SkillSearch';
import { CategoryFilter } from '@/components/skills/CategoryFilter';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: string;
  owner: { id: string; name: string | null; email: string };
  updatedAt: Date | string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadSkills();
  }, [debouncedSearchQuery, selectedCategory]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await skillsApi.list({
        search: debouncedSearchQuery || undefined,
        category: selectedCategory || undefined,
        status: 'PUBLISHED',
      });
      setSkills(response.skills as Skill[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
      console.error('Error loading skills:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    skills.forEach((skill) => {
      if (skill.category) {
        cats.add(skill.category);
      }
    });
    return Array.from(cats).sort();
  }, [skills]);

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            Skills Browser
          </h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
          </div>
        </div>

        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <SkillSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        {categories.length > 0 && (
          <div>
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        )}
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
            <p style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-sm)' }}>
              No skills found
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              {searchQuery || selectedCategory
                ? 'Try adjusting your search or filters'
                : 'No published skills available yet'}
            </p>
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
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                id={skill.id}
                name={skill.name}
                description={skill.description}
                category={skill.category}
                tags={skill.tags}
                owner={skill.owner}
                updatedAt={skill.updatedAt}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
