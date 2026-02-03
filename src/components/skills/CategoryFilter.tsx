'use client';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--spacing-sm)',
        }}
      >
        <button
          onClick={() => onSelectCategory(null)}
          className="btn btn-pill"
          style={{
            background:
              selectedCategory === null
                ? 'var(--color-primary)'
                : 'var(--color-surface-secondary)',
            color:
              selectedCategory === null
                ? 'var(--color-on-primary)'
                : 'var(--color-text)',
            border: '1px solid var(--color-border)',
          }}
          onMouseEnter={(e) => {
            if (selectedCategory !== null) {
              e.currentTarget.style.background = 'var(--color-surface-tertiary)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== null) {
              e.currentTarget.style.background = 'var(--color-surface-secondary)';
            }
          }}
        >
          All Categories
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className="btn btn-pill"
            style={{
              background:
                selectedCategory === category
                  ? 'var(--color-primary)'
                  : 'var(--color-surface-secondary)',
              color:
                selectedCategory === category
                  ? 'var(--color-on-primary)'
                  : 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            onMouseEnter={(e) => {
              if (selectedCategory !== category) {
                e.currentTarget.style.background = 'var(--color-surface-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== category) {
                e.currentTarget.style.background = 'var(--color-surface-secondary)';
              }
            }}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
