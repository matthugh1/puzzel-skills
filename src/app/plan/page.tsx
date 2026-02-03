'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';

interface RecommendedTool {
  toolId: string;
  toolName: string;
  toolDescription: string;
  reason: string;
  exists: boolean;
}

interface RecommendedSkill {
  skillId: string;
  skillName: string;
  skillDescription: string;
  reason: string;
  exists: boolean;
}

interface RecommendedStep {
  stepNumber: number;
  type: string;
  description: string;
  skillId: string | null;
  skillName?: string; // Added for resolved skill names
  inputs: Record<string, string>;
  reason: string;
}

interface Plan {
  workflowName: string;
  workflowDescription: string;
  recommendedTools: RecommendedTool[];
  recommendedSkills: RecommendedSkill[];
  recommendedSteps: RecommendedStep[];
}

export default function PlanPage() {
  const router = useRouter();
  const [userGoal, setUserGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      const response = await apiRequest<{ plan: Plan }>('/api/plan', {
        method: 'POST',
        body: JSON.stringify({
          userGoal: userGoal.trim(),
        }),
      });

      setPlan(response.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      console.error('Error generating plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    if (!plan) return;
    
    // Navigate to workflow creation page with plan data
    // Format matches what the workflow creation page expects
    // Include skillName for matching if skillId doesn't work
    const planData = {
      name: plan.workflowName,
      description: plan.workflowDescription,
      steps: plan.recommendedSteps.map((step) => {
        // Use skillName from step if available (from API resolution), otherwise try to find from recommendedSkills
        let skillName = step.skillName || '';
        
        if (!skillName && step.skillId) {
          // Try to find skill name from recommendedSkills
          const skillInfo = plan.recommendedSkills.find(s => s.skillId === step.skillId);
          skillName = skillInfo?.skillName || '';
        }
        
        const stepData = {
          type: step.type,
          config: {
            skillId: step.skillId || '',
            skillName: skillName, // Include name for matching
            description: step.description,
            inputs: step.inputs,
          },
        };
        
        console.log('[Plan] Creating step:', {
          stepType: step.type,
          stepSkillId: step.skillId,
          stepSkillName: step.skillName,
          resolvedSkillName: skillName,
          finalConfig: stepData.config,
        });
        
        return stepData;
      }),
    };

    console.log('[Plan] Storing plan data:', JSON.stringify(planData, null, 2));
    // Store plan data in sessionStorage and navigate
    sessionStorage.setItem('workflowPlan', JSON.stringify(planData));
    router.push('/workflows/new');
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: 700,
          margin: 0,
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text)',
        }}>
          Workflow Planner
        </h1>
      </header>

      <main className="page-content">
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          {!plan ? (
            <div style={{
              background: 'var(--color-surface)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              padding: '2rem',
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                margin: '0 0 1rem 0',
                color: 'var(--color-text)',
              }}>
                What would you like to do?
              </h2>
              <p style={{
                fontSize: '1rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '1.5rem',
              }}>
                Describe your goal and we'll recommend the tools, skills, and steps needed to create a workflow.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label
                    htmlFor="userGoal"
                    style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Your Goal
                  </label>
                  <textarea
                    id="userGoal"
                    value={userGoal}
                    onChange={(e) => setUserGoal(e.target.value)}
                    required
                    rows={6}
                    placeholder="e.g., I want to analyze contracts and generate summary reports..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--color-text)',
                      background: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.375rem',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '0.375rem',
                    color: 'var(--color-error)',
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !userGoal.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    background: loading || !userGoal.trim() 
                      ? 'var(--color-border)' 
                      : 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: loading || !userGoal.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {loading ? 'Generating Plan...' : 'Generate Plan'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              {/* Plan Header */}
              <div style={{
                background: 'var(--color-surface)',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                padding: '2rem',
                marginBottom: '2rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      margin: '0 0 0.5rem 0',
                      color: 'var(--color-text)',
                    }}>
                      {plan.workflowName}
                    </h2>
                    {plan.workflowDescription && (
                      <p style={{
                        fontSize: '1rem',
                        color: 'var(--color-text-secondary)',
                        margin: 0,
                      }}>
                        {plan.workflowDescription}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setPlan(null);
                      setUserGoal('');
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      background: 'transparent',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Start Over
                  </button>
                </div>
              </div>

              {/* Recommended Tools */}
              {plan.recommendedTools.length > 0 && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  padding: '2rem',
                  marginBottom: '2rem',
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: '0 0 1.5rem 0',
                    color: 'var(--color-text)',
                  }}>
                    Recommended Tools
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {plan.recommendedTools.map((tool, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          background: tool.exists 
                            ? 'var(--color-background)' 
                            : 'rgba(239, 68, 68, 0.05)',
                          border: `1px solid ${tool.exists ? 'var(--color-border)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: '0.375rem',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem',
                        }}>
                          <div>
                            <h4 style={{
                              fontSize: '1rem',
                              fontWeight: 600,
                              margin: '0 0 0.25rem 0',
                              color: 'var(--color-text)',
                            }}>
                              {tool.toolName}
                              {!tool.exists && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-error)',
                                }}>
                                  (Not Found)
                                </span>
                              )}
                            </h4>
                            {tool.toolDescription && (
                              <p style={{
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                                margin: 0,
                              }}>
                                {tool.toolDescription}
                              </p>
                            )}
                          </div>
                        </div>
                        <p style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          margin: '0.5rem 0 0 0',
                          fontStyle: 'italic',
                        }}>
                          {tool.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Skills */}
              {plan.recommendedSkills.length > 0 && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  padding: '2rem',
                  marginBottom: '2rem',
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: '0 0 1.5rem 0',
                    color: 'var(--color-text)',
                  }}>
                    Recommended Skills
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {plan.recommendedSkills.map((skill, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          background: skill.exists 
                            ? 'var(--color-background)' 
                            : 'rgba(239, 68, 68, 0.05)',
                          border: `1px solid ${skill.exists ? 'var(--color-border)' : 'rgba(239, 68, 68, 0.3)'}`,
                          borderRadius: '0.375rem',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem',
                        }}>
                          <div>
                            <h4 style={{
                              fontSize: '1rem',
                              fontWeight: 600,
                              margin: '0 0 0.25rem 0',
                              color: !skill.exists ? 'var(--color-error)' : 'var(--color-text)',
                            }}>
                              {skill.exists ? skill.skillName : `Skill Not Found: ${skill.skillId}`}
                              {!skill.exists && (
                                <span style={{
                                  marginLeft: '0.5rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--color-error)',
                                  fontStyle: 'italic',
                                }}>
                                  (This skill ID doesn't exist in the database. You may need to create this skill or use a different one.)
                                </span>
                              )}
                            </h4>
                            {skill.skillDescription && (
                              <p style={{
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                                margin: 0,
                              }}>
                                {skill.skillDescription}
                              </p>
                            )}
                          </div>
                        </div>
                        <p style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-secondary)',
                          margin: '0.5rem 0 0 0',
                          fontStyle: 'italic',
                        }}>
                          {skill.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Steps */}
              {plan.recommendedSteps.length > 0 && (
                <div style={{
                  background: 'var(--color-surface)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border)',
                  padding: '2rem',
                  marginBottom: '2rem',
                }}>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    margin: '0 0 1.5rem 0',
                    color: 'var(--color-text)',
                  }}>
                    Recommended Steps
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {plan.recommendedSteps.map((step, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          background: 'var(--color-background)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '0.375rem',
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          marginBottom: '0.5rem',
                        }}>
                          <div style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '50%',
                            background: 'var(--color-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}>
                            {step.stepNumber}
                          </div>
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              fontSize: '1rem',
                              fontWeight: 600,
                              margin: '0 0 0.25rem 0',
                              color: 'var(--color-text)',
                            }}>
                              {step.description}
                            </h4>
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-secondary)',
                              marginBottom: '0.5rem',
                            }}>
                              Type: <strong>{step.type}</strong>
                              {step.skillId && (
                                <> • Skill: <strong>{step.skillName || plan.recommendedSkills.find(s => s.skillId === step.skillId)?.skillName || step.skillId}</strong></>
                              )}
                            </div>
                            {Object.keys(step.inputs).length > 0 && (
                              <div style={{
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                                marginTop: '0.5rem',
                              }}>
                                <strong>Inputs:</strong>
                                <ul style={{ margin: '0.25rem 0 0 1.5rem', padding: 0 }}>
                                  {Object.entries(step.inputs).map(([key, value]) => (
                                    <li key={key}>
                                      <strong>{key}:</strong> {value}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <p style={{
                              fontSize: '0.875rem',
                              color: 'var(--color-text-secondary)',
                              margin: '0.5rem 0 0 0',
                              fontStyle: 'italic',
                            }}>
                              {step.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => {
                    setPlan(null);
                    setUserGoal('');
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    background: 'transparent',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Start Over
                </button>
                <button
                  onClick={handleCreateWorkflow}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 500,
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Create Workflow from Plan
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
