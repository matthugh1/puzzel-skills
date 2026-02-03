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
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            background:
              selectedCategory === null
                ? 'var(--color-primary)'
                : 'var(--color-surface-secondary)',
            color:
              selectedCategory === null
                ? 'white'
                : 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-body)',
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
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background:
                selectedCategory === category
                  ? 'var(--color-primary)'
                  : 'var(--color-surface-secondary)',
              color:
                selectedCategory === category
                  ? 'white'
                  : 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-body)',
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
