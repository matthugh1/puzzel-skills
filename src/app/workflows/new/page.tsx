'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { workflowsApi, skillsApi } from '@/lib/api-client';

interface WorkflowStep {
  type: string;
  config: Record<string, unknown>;
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    visibility: 'ORG' as 'TEAM' | 'ORG',
    llmProvider: 'openai' as 'openai' | 'anthropic',
    llmModel: 'gpt-4o-mini',
  });
  const [steps, setSteps] = useState<WorkflowStep[]>([
    { type: 'SKILL', config: { skillId: '', description: '' } },
  ]);

  // Debug: Log steps whenever they change
  useEffect(() => {
    console.log('[Workflow Form] Steps changed:', JSON.stringify(steps, null, 2));
  }, [steps]);
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
    // Ensure CSRF token is available by making a request
    // This triggers the middleware to set the cookie
    fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include',
    }).catch(() => {
      // Ignore errors - middleware will set cookie on next request
    });
  }, []);

  // Load plan data after skills are loaded
  useEffect(() => {
    // Only process plan data if skills have finished loading AND we have skills
    // Wait for the initial load to complete (loadingSkills === false)
    // But also ensure we have skills available (skills.length > 0 or we've tried loading)
    if (loadingSkills) {
      console.log('[Plan] Waiting for skills to load...');
      return;
    }

    // If we haven't loaded skills yet, wait (skills.length === 0 and we haven't tried)
    // But if we've tried and got 0 skills, that's okay - proceed anyway
    const planDataStr = sessionStorage.getItem('workflowPlan');
    if (!planDataStr) {
      console.log('[Plan] No plan data found in sessionStorage');
      return;
    }

    console.log('[Plan] Processing plan data, skills loaded:', skills.length, 'skills available');

    try {
      const planData = JSON.parse(planDataStr);
      console.log('[Plan] Parsed plan data:', planData);
      
      if (planData.name) {
        setFormData((prev) => ({
          ...prev,
          name: planData.name,
          description: planData.description || '',
        }));
      }
      
      if (planData.steps && Array.isArray(planData.steps) && planData.steps.length > 0) {
        const formattedSteps = planData.steps.map((step: any, index: number) => {
          let matchedSkillId = step.config?.skillId || '';
          const originalSkillId = matchedSkillId;
          const skillName = step.config?.skillName || '';
          
          console.log(`[Plan] Processing step ${index + 1}:`, {
            type: step.type,
            originalSkillId,
            skillName,
            availableSkills: skills.length,
          });
          
          // If we have a skillId, try to match it
          if (matchedSkillId && skills.length > 0) {
            const skillById = skills.find(s => s.id === matchedSkillId);
            if (skillById) {
              console.log(`[Plan] Step ${index + 1}: Matched skill by ID: ${matchedSkillId}`);
              matchedSkillId = skillById.id;
            } else if (skillName) {
              // If ID doesn't match, try matching by name (case-insensitive)
              const skillByName = skills.find(s => 
                s.name.toLowerCase().trim() === skillName.toLowerCase().trim()
              );
              if (skillByName) {
                matchedSkillId = skillByName.id;
                console.log(`[Plan] Step ${index + 1}: Matched skill by name: "${skillName}" -> "${skillByName.id}"`);
              } else {
                // Skill not found, leave empty so user can select
                console.warn(`[Plan] Step ${index + 1}: Could not find skill: ID="${matchedSkillId}", Name="${skillName}"`);
                console.log(`[Plan] Available skills:`, skills.map(s => ({ id: s.id, name: s.name })));
                matchedSkillId = '';
              }
            } else {
              // No skillName to match with, leave empty
              console.warn(`[Plan] Step ${index + 1}: No skillName provided for skillId="${matchedSkillId}"`);
              matchedSkillId = '';
            }
          } else if (skillName && skills.length > 0) {
            // Try matching by name only if we don't have a skillId
            const skillByName = skills.find(s => 
              s.name.toLowerCase().trim() === skillName.toLowerCase().trim()
            );
            if (skillByName) {
              matchedSkillId = skillByName.id;
              console.log(`[Plan] Step ${index + 1}: Matched skill by name only: "${skillName}" -> "${skillByName.id}"`);
            } else {
              console.warn(`[Plan] Step ${index + 1}: Could not find skill by name: "${skillName}"`);
              matchedSkillId = '';
            }
          } else if (step.type === 'SKILL') {
            console.warn(`[Plan] Step ${index + 1}: SKILL step has no skillId or skillName`);
            matchedSkillId = '';
          }
          
          const formattedStep = {
            type: step.type || 'SKILL',
            config: {
              skillId: matchedSkillId,
              description: step.config?.description || '',
              inputs: step.config?.inputs || {},
            },
          };
          
          console.log(`[Plan] Formatted step ${index + 1}:`, {
            type: formattedStep.type,
            skillId: formattedStep.config.skillId,
            hasSkillId: !!formattedStep.config.skillId,
          });
          
          return formattedStep;
        });
        
        console.log('[Plan] Final formatted steps:', JSON.stringify(formattedSteps, null, 2));
        console.log('[Plan] Setting steps state...');
        setSteps(formattedSteps);
        
        // Verify steps were set correctly after a brief delay
        setTimeout(() => {
          console.log('[Plan] Steps state after setting:', JSON.stringify(formattedSteps, null, 2));
        }, 100);
      }
      
      // Clear the plan data after using it
      sessionStorage.removeItem('workflowPlan');
      console.log('[Plan] Plan data processed and cleared from sessionStorage');
    } catch (error) {
      console.error('[Plan] Failed to parse plan data:', error);
      sessionStorage.removeItem('workflowPlan');
    }
  }, [loadingSkills, skills]);

  async function loadSkills() {
    try {
      setLoadingSkills(true);
      setSkillsError(null);
      const response = await skillsApi.list();
      setSkills(response.skills as Array<{ id: string; name: string; description?: string | null }>);
    } catch (error) {
      console.error('Failed to load skills:', error);
      setSkillsError('Failed to load skills');
      setSkills([]);
    } finally {
      setLoadingSkills(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tagsArray = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const workflow = await workflowsApi.create({
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        plan: {
          steps: steps,
          metadata: {
            version: '1.0.0',
            description: formData.description || undefined,
          },
        },
        visibility: formData.visibility,
        llmProvider: formData.llmProvider,
        llmModel: formData.llmModel,
      });

      router.push(`/workflows/${(workflow.workflow as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
      console.error('Error creating workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, { type: 'SKILL', config: { skillId: '', description: '' } }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: unknown) => {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      config: {
        ...newSteps[index].config,
        [field]: value,
      },
    };
    setSteps(newSteps);
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
          }}
        >
          <Link
            href="/workflows"
            style={{
              padding: 'var(--spacing-sm)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
            aria-label="Back to workflows"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}
          >
            New Workflow
          </h1>
        </div>
      </header>

      <main className="page-content">
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-lg)',
            }}
          >
            {/* Basic Info */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  margin: '0 0 var(--spacing-md) 0',
                  color: 'var(--color-text)',
                }}
              >
                Basic Information
              </h2>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-md)',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '1rem',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '1rem',
                      fontFamily: 'var(--font-body)',
                      resize: 'vertical',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 'var(--spacing-xs)',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                      }}
                    >
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1rem',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 'var(--spacing-xs)',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                      }}
                    >
                      Visibility
                    </label>
                    <select
                      value={formData.visibility}
                      onChange={(e) =>
                        setFormData({ ...formData, visibility: e.target.value as 'TEAM' | 'ORG' })
                      }
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1rem',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <option value="ORG">Organization</option>
                      <option value="TEAM">Team</option>
                    </select>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--spacing-md)',
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 'var(--spacing-xs)',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                      }}
                    >
                      LLM Provider
                    </label>
                    <select
                      value={formData.llmProvider}
                      onChange={(e) => {
                        const provider = e.target.value as 'openai' | 'anthropic';
                        const defaultModel = provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-7-sonnet-latest';
                        setFormData({ ...formData, llmProvider: provider, llmModel: defaultModel });
                      }}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1rem',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: 'var(--spacing-xs)',
                        fontWeight: 500,
                        color: 'var(--color-text)',
                      }}
                    >
                      Model
                    </label>
                    <select
                      value={formData.llmModel}
                      onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1rem',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {formData.llmProvider === 'openai' ? (
                        <>
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </>
                      ) : (
                        <>
                          <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet (Latest)</option>
                          <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                          <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                          <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (20250929)</option>
                          <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Latest)</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                          <option value="claude-3-opus-latest">Claude 3 Opus (Latest)</option>
                          <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="tag1, tag2, tag3"
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '1rem',
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Workflow Steps */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--spacing-md)',
                }}
              >
                <h2
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    margin: 0,
                    color: 'var(--color-text)',
                  }}
                >
                  Workflow Steps
                </h2>
                <button
                  type="button"
                  onClick={addStep}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  + Add Step
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-md)',
                }}
              >
                {steps.map((step, index) => (
                  <div
                    key={index}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-surface-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--spacing-sm)',
                      }}
                    >
                      <strong>Step {index + 1}</strong>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            background: 'var(--color-danger-bg)',
                            color: 'var(--color-danger-text)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--spacing-sm)',
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: 'block',
                            marginBottom: 'var(--spacing-xs)',
                            fontSize: '0.875rem',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          Step Type
                        </label>
                        <select
                          value={step.type}
                          onChange={(e) => {
                            const newSteps = [...steps];
                            newSteps[index] = {
                              type: e.target.value,
                              config: { skillId: '', description: '' },
                            };
                            setSteps(newSteps);
                          }}
                          style={{
                            width: '100%',
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.875rem',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          <option value="SKILL">Skill</option>
                          <option value="BRANCH">Branch</option>
                          <option value="WAIT">Wait</option>
                        </select>
                      </div>
                      {step.type === 'SKILL' && (
                        <>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 'var(--spacing-xs)',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              Skill *
                            </label>
                            {loadingSkills ? (
                              <div
                                style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  textAlign: 'center',
                                  color: 'var(--color-text-secondary)',
                                  fontSize: '0.875rem',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--color-surface-secondary)',
                                }}
                              >
                                Loading skills...
                              </div>
                            ) : skillsError ? (
                              <div
                                style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  background: 'var(--color-danger-bg)',
                                  color: 'var(--color-danger-text)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.875rem',
                                }}
                              >
                                {skillsError}
                                <button
                                  type="button"
                                  onClick={loadSkills}
                                  style={{
                                    marginTop: 'var(--spacing-xs)',
                                    padding: '2px var(--spacing-xs)',
                                    background: 'var(--color-danger-text)',
                                    color: 'var(--color-on-primary)',
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
                              <select
                                value={(step.config.skillId as string) || ''}
                                onChange={(e) => {
                                  console.log(`[Workflow Form] Skill changed for step ${index + 1}:`, e.target.value);
                                  updateStep(index, 'skillId', e.target.value);
                                }}
                                required
                                style={{
                                  width: '100%',
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  border: '1px solid var(--color-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.875rem',
                                  fontFamily: 'var(--font-body)',
                                  background: 'var(--color-surface)',
                                }}
                              >
                                <option value="">Select a skill</option>
                                {skills.map((skill) => (
                                  <option key={skill.id} value={skill.id}>
                                    {skill.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                marginBottom: 'var(--spacing-xs)',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                              }}
                            >
                              Description
                            </label>
                            <input
                              type="text"
                              value={(step.config.description as string) || ''}
                              onChange={(e) => updateStep(index, 'description', e.target.value)}
                              placeholder="Step description"
                              style={{
                                width: '100%',
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.875rem',
                                fontFamily: 'var(--font-body)',
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: 'var(--spacing-lg)',
                  background: 'var(--color-danger-bg)',
                  color: 'var(--color-danger-text)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Submit Button */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'flex-end',
              }}
            >
              <Link
                href="/workflows"
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
