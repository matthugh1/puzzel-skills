'use client';

import { useState, useEffect } from 'react';
import { workspacesApi } from '@/lib/api-client';

interface AppAction {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  outputSchema: {
    type: string;
    properties: Record<string, unknown>;
  };
}

interface Integration {
  id: string;
  appName: string;
  displayName: string;
  description: string;
  status: string;
  lastSyncAt: string | null;
  actions: AppAction[];
  error?: string;
}

interface IntegrationsSidebarProps {
  workspaceId: string;
  selectedIntegration?: { appName: string; actionName: string } | null;
  onIntegrationActionSelect?: (appName: string, actionName: string) => void;
  onIntegrationActionDeselect?: () => void;
}

export function IntegrationsSidebar({
  workspaceId,
  selectedIntegration,
  onIntegrationActionSelect,
  onIntegrationActionDeselect,
}: IntegrationsSidebarProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadIntegrations();
  }, [workspaceId]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workspacesApi.getIntegrations(workspaceId);
      setIntegrations((response as { integrations: Integration[] }).integrations);
      // Expand all apps by default
      const allAppNames = (response as { integrations: Integration[] }).integrations.map(i => i.appName);
      setExpandedApps(new Set(allAppNames));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
      console.error('Error loading integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleApp = (appName: string) => {
    const newExpanded = new Set(expandedApps);
    if (newExpanded.has(appName)) {
      newExpanded.delete(appName);
    } else {
      newExpanded.add(appName);
    }
    setExpandedApps(newExpanded);
  };

  const filteredIntegrations = integrations.filter((integration) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      integration.displayName.toLowerCase().includes(query) ||
      integration.description.toLowerCase().includes(query) ||
      integration.actions.some(action =>
        action.name.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
      )
    );
  });

  const isActionSelected = (appName: string, actionName: string) => {
    return selectedIntegration?.appName === appName && selectedIntegration?.actionName === actionName;
  };

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
          Integrations
        </h3>
        <input
          type="text"
          placeholder="Search integrations..."
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
            Loading integrations...
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

        {!loading && !error && filteredIntegrations.length === 0 && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            {searchQuery ? 'No integrations found' : 'No connected integrations'}
          </div>
        )}

        {!loading && !error && filteredIntegrations.map((integration) => {
          const isExpanded = expandedApps.has(integration.appName);
          const filteredActions = integration.actions.filter((action) => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            return (
              action.name.toLowerCase().includes(query) ||
              action.description.toLowerCase().includes(query)
            );
          });

          return (
            <div
              key={integration.id}
              style={{
                marginBottom: 'var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-background)',
                overflow: 'hidden',
              }}
            >
              {/* App Header */}
              <div
                onClick={() => toggleApp(integration.appName)}
                style={{
                  padding: 'var(--spacing-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-background)';
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontSize: '0.875rem',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  >
                    {integration.displayName}
                  </div>
                  {integration.description && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {integration.description}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    marginLeft: 'var(--spacing-sm)',
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>

              {/* Actions List */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--color-border)' }}>
                  {integration.error ? (
                    <div
                      style={{
                        padding: 'var(--spacing-md)',
                        fontSize: '0.75rem',
                        color: 'var(--color-danger-text)',
                      }}
                    >
                      {integration.error}
                    </div>
                  ) : filteredActions.length === 0 ? (
                    <div
                      style={{
                        padding: 'var(--spacing-md)',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center',
                      }}
                    >
                      No actions found
                    </div>
                  ) : (
                    filteredActions.map((action) => {
                      const isSelected = isActionSelected(integration.appName, action.name);
                      return (
                        <div
                          key={action.name}
                          onClick={() => {
                            if (isSelected && onIntegrationActionDeselect) {
                              onIntegrationActionDeselect();
                            } else if (onIntegrationActionSelect) {
                              onIntegrationActionSelect(integration.appName, action.name);
                            }
                          }}
                          style={{
                            padding: 'var(--spacing-md)',
                            paddingLeft: 'var(--spacing-lg)',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--color-primary)' : 'transparent',
                            borderTop: '1px solid var(--color-border)',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'var(--color-surface-secondary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: isSelected ? 'white' : 'var(--color-text)',
                              fontSize: '0.8125rem',
                              marginBottom: 'var(--spacing-xs)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>{action.name.replace(/_/g, ' ')}</span>
                            {isSelected && onIntegrationActionDeselect && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onIntegrationActionDeselect();
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
                                aria-label="Deselect action"
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
                            {action.description}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
