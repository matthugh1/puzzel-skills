'use client';

import { useState, useEffect } from 'react';
import { toolsApi } from '@/lib/api-client';

interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

interface ToolsSidebarProps {
  selectedTool?: { id: string; name: string } | null;
  onToolSelect?: (tool: { id: string; name: string }) => void;
  onToolDeselect?: () => void;
}

export function ToolsSidebar({ selectedTool, onToolSelect, onToolDeselect }: ToolsSidebarProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await toolsApi.list();
      setTools(response.tools as Tool[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
      console.error('Error loading tools:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTools = tools.filter((tool) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  });

  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        borderLeft: '1px solid var(--color-border)',
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
          Tools
        </h3>
        <input
          type="text"
          placeholder="Search tools..."
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
            Loading tools...
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

        {!loading && !error && filteredTools.length === 0 && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            {searchQuery ? 'No tools found' : 'No tools available'}
          </div>
        )}

        {!loading && !error && filteredTools.map((tool) => {
          const isSelected = selectedTool?.id === tool.id;
          return (
            <div
              key={tool.id}
              onClick={() => {
                if (isSelected && onToolDeselect) {
                  onToolDeselect();
                } else if (onToolSelect) {
                  onToolSelect({ id: tool.id, name: tool.name });
                }
              }}
              style={{
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-sm)',
                background: isSelected ? 'var(--color-primary)' : 'var(--color-background)',
                border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--color-surface-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--color-background)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: isSelected ? 'white' : 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{tool.name}</span>
                {isSelected && onToolDeselect && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolDeselect();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                    aria-label="Deselect tool"
                  >
                    ×
                  </button>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: isSelected ? 'rgba(255, 255, 255, 0.9)' : 'var(--color-text-secondary)',
                }}
              >
                {tool.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
