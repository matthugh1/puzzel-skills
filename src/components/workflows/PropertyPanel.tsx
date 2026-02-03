'use client';

/**
 * Property Panel Component
 * Edits configuration for selected workflow node
 */

import { useState, useEffect } from 'react';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';
import { skillsApi } from '@/lib/api-client';

interface PropertyPanelProps {
  selectedStep: WorkflowStep | null;
  onUpdate: (step: WorkflowStep) => void;
}

export function PropertyPanel({ selectedStep, onUpdate }: PropertyPanelProps) {
  const [step, setStep] = useState<WorkflowStep | null>(selectedStep);
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState('');

  useEffect(() => {
    setStep(selectedStep);
    if (selectedStep?.type === 'SKILL') {
      loadSkills();
    } else {
      setSkills([]);
      setSkillSearch('');
    }
  }, [selectedStep]);

  async function loadSkills() {
    try {
      setLoadingSkills(true);
      setSkillsError(null);
      const response = await skillsApi.list();
      const allSkills = (response.skills as Array<{ id: string; name: string; description?: string | null }>);
      setSkills(allSkills);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setSkillsError('Failed to load skills. Please try again.');
      setSkills([]);
    } finally {
      setLoadingSkills(false);
    }
  }

  const filteredSkills = skills.filter((skill) => {
    if (!skillSearch) return true;
    const searchLower = skillSearch.toLowerCase();
    return (
      skill.name.toLowerCase().includes(searchLower) ||
      (skill.description && skill.description.toLowerCase().includes(searchLower))
    );
  });

  if (!step) {
    return (
      <div
        style={{
          width: '300px',
          background: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border)',
          padding: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Select a node to edit
      </div>
    );
  }

  function handleConfigChange(field: string, value: unknown) {
    if (!step) return;
    const updatedStep: WorkflowStep = {
      ...step,
      config: {
        ...step.config,
        [field]: value,
      },
    };
    setStep(updatedStep);
    onUpdate(updatedStep);
  }

  function handleNestedConfigChange(path: string[], value: unknown) {
    if (!step) return;
    const updatedConfig = { ...step.config };
    let current: Record<string, unknown> = updatedConfig;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = value;

    const updatedStep: WorkflowStep = {
      ...step,
      config: updatedConfig,
    };
    setStep(updatedStep);
    onUpdate(updatedStep);
  }

  return (
    <div
      style={{
        width: '300px',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        padding: 'var(--spacing-lg)',
        overflowY: 'auto',
        fontFamily: 'var(--font-body)',
      }}
    >
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {step.type} Configuration
      </h3>

      {step.type === 'SKILL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Skill *
            </label>
            {loadingSkills ? (
              <div
                style={{
                  padding: 'var(--spacing-sm)',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.875rem',
                }}
              >
                Loading skills...
              </div>
            ) : skillsError ? (
              <div
                style={{
                  padding: 'var(--spacing-sm)',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                {skillsError}
                <button
                  onClick={loadSkills}
                  style={{
                    marginTop: 'var(--spacing-xs)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: '#991b1b',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                {skills.length > 10 && (
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="Search skills..."
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      marginBottom: 'var(--spacing-xs)',
                    }}
                  />
                )}
                <select
                  value={(step.config.skillId as string) || ''}
                  onChange={(e) => handleConfigChange('skillId', e.target.value)}
                  disabled={loadingSkills}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    background: loadingSkills ? 'var(--color-surface-secondary)' : 'var(--color-surface)',
                    cursor: loadingSkills ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="">Select a skill</option>
                  {filteredSkills.length === 0 && skillSearch ? (
                    <option value="" disabled>
                      No skills found matching "{skillSearch}"
                    </option>
                  ) : (
                    filteredSkills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))
                  )}
                </select>
                {filteredSkills.length > 0 && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      marginTop: 'var(--spacing-xs)',
                    }}
                  >
                    {filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''} available
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {step.type === 'BRANCH' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Condition Type
            </label>
            <select
              value={(step.config.condition?.type as string) || 'JSONPATH'}
              onChange={(e) =>
                handleNestedConfigChange(['condition', 'type'], e.target.value)
              }
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            >
              <option value="JSONPATH">JSONPath</option>
              <option value="AI">AI</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
          {(step.config.condition?.type === 'JSONPATH' ||
            step.config.condition?.type === 'AI') && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                {step.config.condition?.type === 'JSONPATH' ? 'Expression' : 'Prompt'}
              </label>
              <textarea
                value={(step.config.condition?.expression || step.config.condition?.aiPrompt) as string || ''}
                onChange={(e) =>
                  handleNestedConfigChange(
                    [
                      'condition',
                      step.config.condition?.type === 'JSONPATH' ? 'expression' : 'aiPrompt',
                    ],
                    e.target.value
                  )
                }
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  minHeight: '80px',
                }}
              />
            </div>
          )}
        </div>
      )}

      {step.type === 'MERGE' && (
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Merge Strategy
          </label>
          <select
            value={(step.config.mergeStrategy as string) || 'FIRST'}
            onChange={(e) => handleConfigChange('mergeStrategy', e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
            }}
          >
            <option value="FIRST">First</option>
            <option value="ALL">All</option>
            <option value="LAST">Last</option>
          </select>
        </div>
      )}

      {step.type === 'WAIT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Wait Type
            </label>
            <select
              value={(step.config.waitType as string) || 'DURATION'}
              onChange={(e) => handleConfigChange('waitType', e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            >
              <option value="DURATION">Duration</option>
              <option value="UNTIL">Until Date</option>
              <option value="WEBHOOK">Webhook</option>
            </select>
          </div>
          {step.config.waitType === 'DURATION' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Duration (seconds)
              </label>
              <input
                type="number"
                value={(step.config.waitDuration as number) || 60}
                onChange={(e) => handleConfigChange('waitDuration', parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                }}
              />
            </div>
          )}
        </div>
      )}

      {step.type === 'APP_ACTION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              App
            </label>
            <select
              value={(step.config.appId as string) || ''}
              onChange={(e) => handleConfigChange('appId', e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            >
              <option value="">Select app</option>
              <option value="gmail">Gmail</option>
              <option value="slack">Slack</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Action
            </label>
            <input
              type="text"
              value={(step.config.actionId as string) || ''}
              onChange={(e) => handleConfigChange('actionId', e.target.value)}
              placeholder="Action name"
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>
      )}

      {step.type === 'TASK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Task Description *
            </label>
            <input
              type="text"
              value={(step.config.taskDescription as string) || ''}
              onChange={(e) => handleConfigChange('taskDescription', e.target.value)}
              placeholder="Task title"
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Description
            </label>
            <textarea
              value={(step.config.description as string) || ''}
              onChange={(e) => handleConfigChange('description', e.target.value)}
              placeholder="Task details"
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                minHeight: '80px',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Assignee ID (optional)
            </label>
            <input
              type="text"
              value={(step.config.assigneeId as string) || ''}
              onChange={(e) => handleConfigChange('assigneeId', e.target.value)}
              placeholder="User ID (leave empty for run initiator)"
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>
      )}

      {step.type === 'DATA_INPUT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Input Schema (JSON Schema)
            </label>
            <textarea
              value={JSON.stringify(step.config.inputSchema || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleConfigChange('inputSchema', parsed);
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              placeholder='{"type": "object", "properties": {...}}'
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                minHeight: '200px',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              Assignee ID (optional)
            </label>
            <input
              type="text"
              value={(step.config.assigneeId as string) || ''}
              onChange={(e) => handleConfigChange('assigneeId', e.target.value)}
              placeholder="User ID (leave empty for run initiator)"
              style={{
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
