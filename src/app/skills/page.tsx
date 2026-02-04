'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);

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

  const handleCreateFromPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || promptLoading) return;

    setPromptLoading(true);
    setError(null);

    try {
      // Call compose API to generate skill proposal
      const response = await skillsApi.compose([
        {
          role: 'user',
          content: promptInput.trim(),
        },
      ]);

      if (response.response.type === 'proposal' && response.response.skill) {
        // Store proposal in sessionStorage for the create page to pick up
        sessionStorage.setItem('skillProposal', JSON.stringify(response.response.skill));
        // Navigate to create page
        router.push('/my-skills/new?fromPrompt=true');
      } else {
        // If we got a question instead of a proposal, we need more conversation
        // For now, let's navigate to the chat page with the prompt
        sessionStorage.setItem('initialPrompt', promptInput.trim());
        router.push('/my-skills/new/chat');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate skill from prompt';
      setError(errorMessage);
      console.error('Error creating skill from prompt:', err);
    } finally {
      setPromptLoading(false);
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
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
            </div>
            <button
              onClick={() => setShowPromptInput(!showPromptInput)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: showPromptInput ? 'var(--color-surface-secondary)' : 'var(--color-primary)',
                color: showPromptInput ? 'var(--color-text)' : 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {showPromptInput ? 'Cancel' : '+ Create from Prompt'}
            </button>
          </div>
        </div>

        {showPromptInput && (
          <form
            onSubmit={handleCreateFromPrompt}
            style={{
              padding: 'var(--spacing-lg)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <label
              htmlFor="prompt-input"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              Describe the skill you want to create
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
              <textarea
                id="prompt-input"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g., Create a skill that formats documents into clean markdown with proper headings and structure"
                disabled={promptLoading}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text)',
                  background: 'var(--color-background)',
                  resize: 'vertical',
                  minHeight: '80px',
                }}
                rows={3}
              />
              <button
                type="submit"
                disabled={!promptInput.trim() || promptLoading}
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  background: promptInput.trim() && !promptLoading ? 'var(--color-primary)' : 'var(--color-surface-secondary)',
                  color: promptInput.trim() && !promptLoading ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: promptInput.trim() && !promptLoading ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                }}
              >
                {promptLoading ? 'Generating...' : 'Create Skill'}
              </button>
            </div>
            <p
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              AI will generate a complete skill template based on your description
            </p>
          </form>
        )}

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
