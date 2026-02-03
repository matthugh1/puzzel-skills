'use client';

import { useState, useEffect, useRef } from 'react';
import { workflowsApi } from '@/lib/api-client';
import { getDefaultModel, getAvailableModels, type LLMProvider } from '@/lib/llm/client';

interface WorkflowStep {
  type: string;
  config: Record<string, unknown>;
}

interface WorkflowPlan {
  steps: WorkflowStep[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

interface StepUpdate {
  id: string;
  stepIndex: number;
  status: string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  errorMessage: string | null;
  inputContext?: Record<string, unknown>;
  outputContext?: Record<string, unknown>;
}

interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  stepIndex?: number;
  stepId?: string;
  message: string;
  details?: Record<string, unknown>;
}

interface RunState {
  id: string;
  status: string;
  goal: string;
  currentStepIndex: number;
  steps: StepUpdate[];
  executionLogs?: ExecutionLogEntry[];
}

interface TestRunnerProps {
  workflowId: string;
  plan: WorkflowPlan;
  onClose?: () => void;
  usePlanOverride?: boolean; // If true, use the provided plan instead of fetching from workflow
}

export function TestRunner({ workflowId, plan, onClose, usePlanOverride = false }: TestRunnerProps) {
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [showInputForm, setShowInputForm] = useState(true);
  const [initialContext, setInitialContext] = useState<Record<string, string>>({});
  const [fileInputs, setFileInputs] = useState<Record<string, File | null>>({});
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai');
  const [llmModel, setLlmModel] = useState<string>('gpt-4o-mini');
  const [artefacts, setArtefacts] = useState<Record<string, unknown>>({});
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch workflow to initialize LLM defaults
  useEffect(() => {
    const loadWorkflowDefaults = async () => {
      try {
        const response = await workflowsApi.getById(workflowId);
        const workflow = response.workflow as { llmProvider?: string | null; llmModel?: string | null };
        
        if (workflow.llmProvider) {
          const provider = workflow.llmProvider as LLMProvider;
          setLlmProvider(provider);
          setLlmModel(workflow.llmModel || getDefaultModel(provider));
        } else {
          // Use defaults if workflow doesn't have LLM config
          setLlmProvider('openai');
          setLlmModel(getDefaultModel('openai'));
        }
      } catch (err) {
        console.error('[TestRunner] Error loading workflow defaults:', err);
        // Keep defaults on error
      }
    };
    
    loadWorkflowDefaults();
  }, [workflowId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startTest = async () => {
    try {
      console.log('[TestRunner] Starting test run...');
      console.log('[TestRunner] Workflow ID:', workflowId);
      console.log('[TestRunner] Use plan override:', usePlanOverride);
      
      setRunning(true);
      setError(null);
      setRunState(null);

      // Prepare initial context (text inputs only - files will be sent separately)
      const textContext: Record<string, string> = Object.fromEntries(
        Object.entries(initialContext)
          .map(([key, value]) => [key, value.trim()])
          .filter(([_, value]) => value.length > 0)
      );

      // Filter out file inputs that have files (they'll be sent as FormData)
      const filesToUpload = new Map<string, File>();
      for (const [key, file] of Object.entries(fileInputs)) {
        if (file) {
          filesToUpload.set(key, file);
        }
      }

      // Start test run (include plan override if provided)
      const testData: {
        initialContext: Record<string, unknown>;
        plan?: WorkflowPlan;
        files?: Map<string, File>;
        llmProvider?: LLMProvider;
        llmModel?: string;
      } = {
        initialContext: textContext,
        ...(filesToUpload.size > 0 ? { files: filesToUpload } : {}),
        llmProvider,
        llmModel,
      };
      
      if (usePlanOverride) {
        testData.plan = plan;
        console.log('[TestRunner] Including plan override with', plan.steps?.length || 0, 'steps');
      }

      console.log('[TestRunner] Calling workflowsApi.test...', { 
        hasFiles: filesToUpload.size > 0, 
        fileCount: filesToUpload.size 
      });
      const response = await workflowsApi.test(workflowId, testData);
      console.log('[TestRunner] Test API response received:', response);

      const newRunId = (response.run as { id: string }).id;
      console.log('[TestRunner] Run ID:', newRunId);
      setRunId(newRunId);

      // Connect to SSE stream
      console.log('[TestRunner] Connecting to SSE stream...');
      connectToStream(newRunId);
    } catch (err) {
      console.error('[TestRunner] Error starting test:', err);
      console.error('[TestRunner] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(err instanceof Error ? err.message : 'Failed to start test run');
      setRunning(false);
    }
  };

  const copyLogsToClipboard = async () => {
    try {
      // Format logs in a readable way
      const formattedLogs = executionLogs.map((log, idx) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const level = log.level.toUpperCase().padEnd(8);
        const stepInfo = log.stepIndex !== undefined ? `[Step ${log.stepIndex}] ` : '';
        let logText = `${timestamp} ${level} ${stepInfo}${log.message}`;
        
        if (log.details && Object.keys(log.details).length > 0) {
          logText += `\n  Details: ${JSON.stringify(log.details, null, 2)}`;
        }
        
        return logText;
      }).join('\n\n');

      const fullLogText = `Workflow Test Execution Logs\nRun ID: ${runId || 'N/A'}\n${'='.repeat(80)}\n\n${formattedLogs}`;
      
      await navigator.clipboard.writeText(fullLogText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
      setError('Failed to copy logs to clipboard');
    }
  };

  const connectToStream = (id: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/runs/${id}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'initial') {
          console.log('[TestRunner] Initial state received, execution logs:', data.executionLogs?.length || 0);
          setRunState(data.run);
          if (data.executionLogs) {
            console.log('[TestRunner] Setting initial execution logs:', data.executionLogs.map((l: ExecutionLogEntry) => l.message));
            setExecutionLogs(data.executionLogs);
          }
        } else if (data.type === 'execution_log') {
          console.log('[TestRunner] New execution log received:', data.log.message);
          setExecutionLogs((prev) => [...prev, data.log]);
        } else if (data.type === 'step_update') {
          console.log('[TestRunner] Step update received:', data.step);
          setRunState((prev) => {
            if (!prev) return prev;
            const updatedSteps = [...prev.steps];
            const existingIndex = updatedSteps.findIndex(
              (s) => s.stepIndex === data.step.stepIndex
            );
            
            const stepUpdate = {
              ...data.step,
              // Ensure we have all fields
              id: data.step.id,
              stepIndex: data.step.stepIndex,
              status: data.step.status,
              startedAt: data.step.startedAt,
              completedAt: data.step.completedAt,
              errorMessage: data.step.errorMessage || null,
              inputContext: data.step.inputContext || {},
              outputContext: data.step.outputContext || {},
            };
            
            if (existingIndex >= 0) {
              updatedSteps[existingIndex] = stepUpdate;
            } else {
              updatedSteps.push(stepUpdate);
            }
            
            // Sort steps by stepIndex
            updatedSteps.sort((a, b) => a.stepIndex - b.stepIndex);
            
            return {
              ...prev,
              steps: updatedSteps,
              currentStepIndex: Math.max(
                prev.currentStepIndex,
                data.step.stepIndex
              ),
            };
          });
          
          // If step has an error, also set it in the error state for visibility
          if (data.step.errorMessage) {
            setError((prev) => {
              const newError = `Step ${data.step.stepIndex + 1} Error: ${data.step.errorMessage}`;
              return prev ? `${prev}\n\n${newError}` : newError;
            });
          }
        } else if (data.type === 'status_update') {
          setRunState((prev) => {
            if (!prev) return prev;
            return { ...prev, status: data.status };
          });

          // Set error if status update includes error details
          if (data.status === 'FAILED' && data.error) {
            const errorMessage = data.errorStack 
              ? `${data.error}\n\nStack trace:\n${data.errorStack}`
              : data.error;
            setError(errorMessage);
          }

          // Stop if complete
          if (
            data.status === 'COMPLETE' ||
            data.status === 'FAILED' ||
            data.status === 'CANCELLED'
          ) {
            setRunning(false);
            eventSource.close();
            
            // Fetch full run data to ensure we have complete outputContext for all steps
            // Use async IIFE since onmessage callback is not async
            (async () => {
              try {
                const fullRunResponse = await fetch(`/api/runs/${id}`);
                if (fullRunResponse.ok) {
                  const fullRunData = await fullRunResponse.json();
                  if (fullRunData.run?.steps) {
                    // Also fetch artefacts to check for file references
                    try {
                      const artefactsResponse = await fetch(`/api/runs/${id}/artefacts`);
                      if (artefactsResponse.ok) {
                        const artefactsData = await artefactsResponse.json();
                        if (artefactsData.artefacts) {
                          const artefactsMap: Record<string, unknown> = {};
                          artefactsData.artefacts.forEach((art: { id: string; content: unknown }) => {
                            artefactsMap[art.id] = art.content;
                          });
                          setArtefacts(artefactsMap);
                        }
                      }
                    } catch (artefactError) {
                      console.error('[TestRunner] Error fetching artefacts:', artefactError);
                    }
                    
                    setRunState((prev) => {
                      if (!prev) return prev;
                      // Update steps with full data from API (including outputContext)
                      const updatedSteps = prev.steps.map((prevStep) => {
                        const apiStep = fullRunData.run.steps.find(
                          (s: StepUpdate) => s.stepIndex === prevStep.stepIndex
                        );
                        if (apiStep) {
                          // Merge API step data, preserving outputContext
                          return {
                            ...prevStep,
                            ...apiStep,
                            inputContext: apiStep.inputContext || prevStep.inputContext || {},
                            outputContext: apiStep.outputContext || prevStep.outputContext || {},
                          };
                        }
                        return prevStep;
                      });
                      return {
                        ...prev,
                        steps: updatedSteps,
                      };
                    });
                  }
                }
              } catch (fetchError) {
                console.error('[TestRunner] Error fetching full run data:', fetchError);
                // Don't fail - we already have the data from the stream
              }
            })();
          }
        } else if (data.type === 'error') {
          setError(data.error || 'Stream error occurred');
          setRunning(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      // SSE connection closed or error
      setRunning(false);
      eventSource.close();
    };
  };

  const stopTest = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setRunning(false);
  };

  const getStepStatus = (stepIndex: number): string => {
    if (!runState) return 'pending';
    const step = runState.steps.find((s) => s.stepIndex === stepIndex);
    if (!step) {
      if (stepIndex < runState.currentStepIndex) {
        return 'pending';
      }
      if (stepIndex === runState.currentStepIndex) {
        return runState.status === 'RUNNING' ? 'running' : 'pending';
      }
      return 'pending';
    }
    return step.status.toLowerCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete':
      case 'succeeded':
        return { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success)' };
      case 'running':
        return { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-text)' };
      case 'failed':
        return { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', border: 'var(--color-danger)' };
      case 'pending':
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)', border: 'var(--color-border)' };
      default:
        return { bg: 'var(--color-surface-secondary)', text: 'var(--color-text-secondary)', border: 'var(--color-border)' };
    }
  };

  const getStepError = (stepIndex: number): string | null => {
    if (!runState) return null;
    const step = runState.steps.find((s) => s.stepIndex === stepIndex);
    return step?.errorMessage || null;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '500px',
        maxWidth: '90vw',
        background: 'var(--color-background)',
        boxShadow: 'var(--shadow-panel)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transform: 'translateX(0)',
        transition: 'transform 0.3s ease-in-out',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          padding: 'var(--spacing-xl)',
          overflow: 'auto',
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--spacing-lg)',
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
            Test Workflow
          </h2>
          {onClose && (
            <button
              onClick={() => {
                stopTest();
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                padding: 'var(--spacing-xs)',
              }}
            >
              ×
            </button>
          )}
        </div>

        {!running && !runState && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Run a test execution of this workflow to see real-time updates and identify any failures.
            </p>
            
            {/* LLM Configuration */}
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
              }}
            >
              <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                LLM Configuration
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    Provider:
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => {
                      const provider = e.target.value as LLMProvider;
                      setLlmProvider(provider);
                      setLlmModel(getDefaultModel(provider));
                    }}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-body)',
                      background: 'var(--color-background)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: 'var(--color-text)',
                    }}
                  >
                    Model:
                  </label>
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-sm)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-body)',
                      background: 'var(--color-background)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {getAvailableModels(llmProvider).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {/* Input Form for Initial Context */}
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
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
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  Initial Context (Optional)
                </h4>
                <button
                  onClick={() => setShowInputForm(!showInputForm)}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {showInputForm ? 'Hide' : 'Show'}
                </button>
              </div>
              
              {showInputForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Provide input values that will be available to all workflow steps. Upload files or enter text.
                  </p>
                  
                  {/* Extract potential inputs from workflow steps */}
                  {(() => {
                    const potentialInputs = new Set<string>();
                    plan.steps?.forEach((step) => {
                      if (step.type === 'SKILL' && step.config?.inputs) {
                        Object.keys(step.config.inputs as Record<string, unknown>).forEach((key) => {
                          potentialInputs.add(key);
                        });
                      }
                    });
                    
                    // Add a generic file input if none found
                    if (potentialInputs.size === 0) {
                      potentialInputs.add('file');
                    }
                    
                    // Generic file input option - any field can accept a file
                    // Users can add custom fields via the "Add Input Field" button

                    return Array.from(potentialInputs).map((inputKey) => {
                      const file = fileInputs[inputKey];
                      
                      return (
                        <div key={inputKey}>
                          <label
                            style={{
                              display: 'block',
                              marginBottom: 'var(--spacing-xs)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              color: 'var(--color-text)',
                            }}
                          >
                            {inputKey.charAt(0).toUpperCase() + inputKey.slice(1)}:
                          </label>
                          {/* All inputs can accept either file upload or text */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                            <input
                              type="file"
                              accept="*/*"
                              onChange={(e) => {
                                const selectedFile = e.target.files?.[0] || null;
                                setFileInputs({ ...fileInputs, [inputKey]: selectedFile });
                                // Clear text input if file is selected
                                if (selectedFile) {
                                  setInitialContext({ ...initialContext, [inputKey]: '' });
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: 'var(--spacing-sm)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-body)',
                              }}
                            />
                            {file && (
                              <div
                                style={{
                                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                                  background: 'var(--color-surface-secondary)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontSize: '0.7rem',
                                  color: 'var(--color-text-secondary)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                                <button
                                  onClick={() => {
                                    setFileInputs({ ...fileInputs, [inputKey]: null });
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    padding: 'var(--spacing-xs)',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--color-text-secondary)',
                                fontStyle: 'italic',
                              }}
                            >
                              Or enter text below:
                            </div>
                            <textarea
                              value={initialContext[inputKey] || ''}
                              onChange={(e) => {
                                setInitialContext({ ...initialContext, [inputKey]: e.target.value });
                                // Clear file if text is entered
                                if (e.target.value.trim()) {
                                  setFileInputs({ ...fileInputs, [inputKey]: null });
                                }
                              }}
                              placeholder={`Or paste ${inputKey} text here...`}
                              rows={3}
                              style={{
                                width: '100%',
                                padding: 'var(--spacing-sm)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontFamily: 'var(--font-body)',
                                resize: 'vertical',
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                  
                  {/* Add custom input field button */}
                  <button
                    onClick={() => {
                      const newKey = `input${Object.keys(initialContext).length + 1}`;
                      setInitialContext({ ...initialContext, [newKey]: '' });
                    }}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: 'var(--color-surface-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                      alignSelf: 'flex-start',
                    }}
                  >
                    + Add Input Field
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={startTest}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Start Test Run
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger-text)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
              Error:
            </div>
            <pre
              style={{
                margin: 0,
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflow: 'auto',
                maxHeight: '300px',
              }}
            >
              {error}
            </pre>
          </div>
        )}

        {runState && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--spacing-md)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-text)' }}>Run Status:</strong>{' '}
                <span
                  style={{
                    padding: '4px var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    ...getStatusColor(runState.status.toLowerCase()),
                  }}
                >
                  {runState.status.toLowerCase()}
                </span>
              </div>
              {running && (
                <button
                  onClick={stopTest}
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-md)',
                    background: 'var(--color-danger-bg)',
                    color: 'var(--color-danger-text)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  Stop
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
              <h3
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  margin: 0,
                  color: 'var(--color-text)',
                }}
              >
                Execution Steps
              </h3>
              {plan.steps.map((step, index) => {
                const stepStatus = getStepStatus(index);
                const stepError = getStepError(index);
                const colors = getStatusColor(stepStatus);

                return (
                  <div
                    key={index}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--color-surface)',
                      border: `2px solid ${colors.border}`,
                      borderRadius: 'var(--radius-md)',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: stepError ? 'var(--spacing-sm)' : 0,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: 'var(--color-text)' }}>
                          Step {index + 1}: {step.type}
                        </strong>
                        {step.config && Object.keys(step.config).length > 0 && (
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--color-text-secondary)',
                              marginTop: 'var(--spacing-xs)',
                            }}
                          >
                            {step.type === 'SKILL' && step.config.skillId && (
                              <div>Skill ID: {String(step.config.skillId)}</div>
                            )}
                            {step.config.description && (
                              <div>{String(step.config.description)}</div>
                            )}
                            {/* Show tool usage info if available */}
                            {(() => {
                              const dbStep = runState?.steps.find((s) => s.stepIndex === index);
                              
                              // Check execution logs for tool execution messages
                              const toolLogs = executionLogs.filter(log => 
                                log.stepIndex === index && 
                                (log.message?.toLowerCase().includes('tool executed') || 
                                 log.message?.toLowerCase().includes('executing tool'))
                              );
                              
                              if (dbStep?.outputContext) {
                                const outputCtx = dbStep.outputContext as Record<string, unknown>;
                                const metadata = outputCtx.metadata as Record<string, unknown> | undefined;
                                
                                // Show if tool was executed (from metadata)
                                if (metadata?.toolExecuted || metadata?.toolId) {
                                  return (
                                    <div style={{ 
                                      marginTop: 'var(--spacing-xs)',
                                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                                      background: 'var(--color-info-bg)',
                                      border: '1px solid var(--color-info-border)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.75rem',
                                      color: 'var(--color-info-text)',
                                    }}>
                                      🔧 Tool Executed: {String(metadata.toolId || 'Unknown')}
                                      {metadata.fileRef && (
                                        <div style={{ marginTop: 'var(--spacing-xs)', fontSize: '0.7rem' }}>
                                          File: {String(metadata.fileRef).split('/').pop()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // Show if LLM was used (has model/provider in metadata but no toolExecuted)
                                if (metadata?.model && !metadata.toolExecuted) {
                                  return (
                                    <div style={{ 
                                      marginTop: 'var(--spacing-xs)',
                                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                                      background: 'var(--color-neutral-bg)',
                                      border: '1px solid var(--color-neutral-border)',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.75rem',
                                      color: 'var(--color-neutral-text)',
                                    }}>
                                      🤖 LLM Used: {String(metadata.model || 'Unknown')} ({String(metadata.provider || 'Unknown')})
                                    </div>
                                  );
                                }
                              }
                              
                              // Show tool execution from logs
                              if (toolLogs.length > 0) {
                                const toolLog = toolLogs[0];
                                const toolId = toolLog.details?.toolId as string | undefined;
                                return (
                                  <div style={{ 
                                    marginTop: 'var(--spacing-xs)',
                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                    background: 'var(--color-info-bg)',
                                    border: '1px solid var(--color-info-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    color: 'var(--color-info-text)',
                                  }}>
                                    🔧 Tool Executed: {toolId || 'Unknown'}
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '4px var(--spacing-sm)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          textTransform: 'capitalize',
                          ...colors,
                        }}
                      >
                        {stepStatus}
                      </span>
                    </div>
                    {stepStatus === 'running' && (
                      <div
                        style={{
                          marginTop: 'var(--spacing-sm)',
                          padding: 'var(--spacing-sm)',
                          background: 'var(--color-info-bg)',
                          color: 'var(--color-info-text)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--color-info-text)',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                          }}
                        />
                        <span>Executing...</span>
                      </div>
                    )}
                    {stepError && (
                      <div
                        style={{
                          marginTop: 'var(--spacing-sm)',
                          padding: 'var(--spacing-md)',
                          background: 'var(--color-danger-bg)',
                          border: '1px solid var(--color-danger-border)',
                          color: 'var(--color-danger-text)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-xs)' }}>
                          ❌ Error:
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {stepError}
                        </div>
                      </div>
                    )}
                    {stepStatus === 'success' && (
                      <div
                        style={{
                          marginTop: 'var(--spacing-sm)',
                          padding: 'var(--spacing-sm)',
                          background: 'var(--color-success-bg)',
                          color: 'var(--color-success-text)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-xs)',
                        }}
                      >
                        <span>✅</span>
                        <span>Completed successfully</span>
                      </div>
                    )}
                    {/* Show step details if available */}
                    {runState?.steps && (() => {
                      const dbStep = runState.steps.find((s) => s.stepIndex === index);
                      if (dbStep) {
                        return (
                          <div
                            style={{
                              marginTop: 'var(--spacing-sm)',
                              padding: 'var(--spacing-sm)',
                              background: 'var(--color-surface-secondary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                            }}
                          >
                            {dbStep.startedAt && (
                              <div style={{ color: 'var(--color-text-secondary)' }}>
                                Started: {new Date(dbStep.startedAt).toLocaleTimeString()}
                              </div>
                            )}
                            {dbStep.completedAt && (
                              <div style={{ color: 'var(--color-text-secondary)' }}>
                                Completed: {new Date(dbStep.completedAt).toLocaleTimeString()}
                              </div>
                            )}
                            {dbStep.inputContext && Object.keys(dbStep.inputContext).length > 0 && (
                              <details style={{ marginTop: 'var(--spacing-xs)' }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                  Inputs
                                </summary>
                                <pre
                                  style={{
                                    marginTop: 'var(--spacing-xs)',
                                    fontSize: '0.7rem',
                                    overflow: 'auto',
                                    maxHeight: '100px',
                                  }}
                                >
                                  {JSON.stringify(dbStep.inputContext, null, 2)}
                                </pre>
                              </details>
                            )}
                            {dbStep.outputContext && (() => {
                              const outputCtx = dbStep.outputContext as Record<string, unknown>;
                              // Check for file references in outputContext
                              const fileRefs: Array<{ ref: string; fileName?: string }> = [];
                              
                              // Debug: Log the entire outputContext to help diagnose
                              console.log('[TestRunner] Full outputContext:', JSON.stringify(outputCtx, null, 2));
                              
                              // Helper function to recursively find file references
                              const findFileRefs = (obj: unknown, path: string[] = []): void => {
                                if (typeof obj === 'string' && obj.startsWith('__file__:')) {
                                  console.log('[TestRunner] Found file reference at path:', path.join('.'), ':', obj);
                                  fileRefs.push({ ref: obj });
                                  return;
                                }
                                if (obj && typeof obj === 'object') {
                                  if (Array.isArray(obj)) {
                                    obj.forEach((item, idx) => findFileRefs(item, [...path, String(idx)]));
                                  } else {
                                    const record = obj as Record<string, unknown>;
                                    for (const [key, value] of Object.entries(record)) {
                                      // Special handling for metadata.fileRef and metadata.fileName
                                      if (key === 'fileRef' && typeof value === 'string' && value.startsWith('__file__:')) {
                                        const fileName = record.fileName && typeof record.fileName === 'string' 
                                          ? record.fileName 
                                          : undefined;
                                        console.log('[TestRunner] Found fileRef in metadata:', value, 'fileName:', fileName);
                                        fileRefs.push({ ref: value, fileName });
                                      } else {
                                        findFileRefs(value, [...path, key]);
                                      }
                                    }
                                  }
                                }
                              };
                              
                              // Search for file references in the entire outputContext
                              findFileRefs(outputCtx);
                              
                              // Also check artefactRefs - extract artefact IDs and check artefact content for file references
                              // Artefact IDs are in format: artefact-{id}
                              if (outputCtx.artefactRefs && Array.isArray(outputCtx.artefactRefs) && fileRefs.length === 0) {
                                console.log('[TestRunner] Found artefactRefs but no fileRefs:', outputCtx.artefactRefs);
                                
                                // Check each artefact's content for file references
                                // Access artefacts from component state (closure captures it)
                                for (const artefactRef of outputCtx.artefactRefs) {
                                  if (typeof artefactRef === 'string' && artefactRef.startsWith('artefact-')) {
                                    const artefactId = artefactRef.replace('artefact-', '');
                                    // Access artefacts state variable from component scope
                                    const artefactContent = artefacts[artefactId];
                                    if (artefactContent) {
                                      console.log('[TestRunner] Checking artefact content:', artefactId, artefactContent);
                                      // Recursively search artefact content for file references
                                      findFileRefs(artefactContent, ['artefact', artefactId]);
                                    }
                                  }
                                }
                                
                                // Also check if metadata has fileRef even if not detected by recursive search
                                if (outputCtx.metadata && typeof outputCtx.metadata === 'object') {
                                  const metadata = outputCtx.metadata as Record<string, unknown>;
                                  if (typeof metadata.fileRef === 'string' && metadata.fileRef.startsWith('__file__:')) {
                                    console.log('[TestRunner] Found fileRef in metadata after artefactRefs check:', metadata.fileRef);
                                    fileRefs.push({
                                      ref: metadata.fileRef,
                                      fileName: typeof metadata.fileName === 'string' ? metadata.fileName : undefined
                                    });
                                  }
                                }
                              }
                              
                              // Remove duplicates
                              const uniqueFileRefs = Array.from(
                                new Map(fileRefs.map(f => [f.ref, f])).values()
                              );
                              
                              console.log('[TestRunner] Total unique file references found:', uniqueFileRefs.length);
                              
                              return (
                                <div style={{ marginTop: 'var(--spacing-xs)' }}>
                                  {uniqueFileRefs.length > 0 ? (
                                    <div style={{ 
                                      marginBottom: 'var(--spacing-sm)',
                                      padding: 'var(--spacing-sm)',
                                      background: 'var(--color-info-bg)',
                                      border: '1px solid var(--color-info-border)',
                                      borderRadius: 'var(--radius-sm)',
                                    }}>
                                      <div style={{ 
                                        fontSize: '0.75rem', 
                                        fontWeight: 600,
                                        marginBottom: 'var(--spacing-xs)',
                                        color: 'var(--color-info-text)'
                                      }}>
                                        Generated Files:
                                      </div>
                                      {uniqueFileRefs.map((file, idx) => {
                                        const encodedRef = encodeURIComponent(file.ref);
                                        // Extract filename from file reference or use provided fileName
                                        // File ref format: __file__:runId/filename.docx
                                        let fileName = file.fileName;
                                        if (!fileName && file.ref.includes('/')) {
                                          fileName = file.ref.split('/').pop() || 'document.docx';
                                        } else if (!fileName) {
                                          fileName = file.ref.replace('__file__:', '').split('/').pop() || 'document.docx';
                                        }
                                        // Ensure .docx extension for Word documents
                                        if (!fileName.endsWith('.docx') && !fileName.includes('.')) {
                                          fileName = `${fileName}.docx`;
                                        }
                                        
                                        return (
                                          <a
                                            key={idx}
                                            href={`/api/files/${encodedRef}`}
                                            download={fileName}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 'var(--spacing-xs)',
                                              padding: 'var(--spacing-sm) var(--spacing-md)',
                                              background: 'var(--color-primary)',
                                              color: 'var(--color-on-primary)',
                                              textDecoration: 'none',
                                              borderRadius: 'var(--radius-sm)',
                                              fontSize: '0.875rem',
                                              fontWeight: 500,
                                              marginRight: 'var(--spacing-xs)',
                                              marginBottom: 'var(--spacing-xs)',
                                              cursor: 'pointer',
                                              transition: 'background-color 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = 'var(--color-primary-dark)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = 'var(--color-primary)';
                                            }}
                                          >
                                            <span>📄</span>
                                            <span>Download {fileName}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div style={{ 
                                      fontSize: '0.7rem', 
                                      color: 'var(--color-neutral-text)',
                                      fontStyle: 'italic',
                                      marginBottom: 'var(--spacing-xs)',
                                      padding: 'var(--spacing-xs)',
                                      background: 'var(--color-surface-secondary)',
                                      borderRadius: 'var(--radius-sm)',
                                    }}>
                                      No downloadable files detected. Check console for outputContext structure.
                                    </div>
                                  )}
                                  <details>
                                    <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                                      Outputs
                                    </summary>
                                    <pre
                                      style={{
                                        marginTop: 'var(--spacing-xs)',
                                        fontSize: '0.7rem',
                                        overflow: 'auto',
                                        maxHeight: '100px',
                                      }}
                                    >
                                      {JSON.stringify(dbStep.outputContext, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Execution Logs */}
            {executionLogs.length > 0 && (
              <div
                style={{
                  marginTop: 'var(--spacing-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      margin: 0,
                      color: 'var(--color-text)',
                    }}
                  >
                    Execution Logs
                  </h3>
                  <button
                    onClick={copyLogsToClipboard}
                    disabled={executionLogs.length === 0}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: copied ? 'var(--color-success)' : 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: executionLogs.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: executionLogs.length === 0 ? 0.5 : 1,
                      transition: 'background-color 0.2s',
                    }}
                    title="Copy all execution logs to clipboard"
                  >
                    {copied ? '✓ Copied!' : 'Copy Logs'}
                  </button>
                </div>
                <div
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-sm)',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {executionLogs.map((log, idx) => {
                    const levelColors: Record<string, { bg: string; text: string; border: string }> = {
                      info: { bg: 'var(--color-info-bg)', text: 'var(--color-info-text)', border: 'var(--color-info-border)' },
                      success: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)', border: 'var(--color-success-border)' },
                      warn: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)', border: 'var(--color-warning-border)' },
                      error: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
                    };
                    const colors = levelColors[log.level] || levelColors.info;
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 'var(--spacing-xs)',
                          marginBottom: 'var(--spacing-xs)',
                          background: colors.bg,
                          borderLeft: `3px solid ${colors.border}`,
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
                          <span style={{ color: colors.text, fontWeight: 600, minWidth: '60px' }}>
                            {log.level.toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ marginTop: 'var(--spacing-xs)', color: colors.text }}>
                          {log.message}
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <details style={{ marginTop: 'var(--spacing-xs)' }}>
                            <summary style={{ cursor: 'pointer', color: colors.text, fontSize: '0.7rem' }}>
                              Details
                            </summary>
                            <pre
                              style={{
                                marginTop: 'var(--spacing-xs)',
                                fontSize: '0.65rem',
                                overflow: 'auto',
                                maxHeight: '150px',
                                background: 'var(--color-surface-tertiary)',
                                padding: 'var(--spacing-xs)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Test Output - Formatted JSON */}
            {runState && (runState.status === 'COMPLETE' || runState.status === 'FAILED') && (
              <div
                style={{
                  marginTop: 'var(--spacing-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      margin: 0,
                      color: 'var(--color-text)',
                    }}
                  >
                    Test Output
                  </h3>
                  <button
                    onClick={async () => {
                      try {
                        // Create formatted JSON output with full response content
                        const output = {
                          runId: runId || 'N/A',
                          status: runState.status,
                          goal: runState.goal,
                          completedAt: runState.steps[runState.steps.length - 1]?.completedAt || null,
                          steps: runState.steps.map((step) => {
                            // Extract full response from outputContext
                            const outputCtx = (step.outputContext as Record<string, unknown>) || {};
                            const rawResponse = outputCtx.raw || null;
                            const structuredData = outputCtx.data || null;
                            
                            return {
                              stepIndex: step.stepIndex,
                              status: step.status,
                              inputContext: step.inputContext || {},
                              outputContext: {
                                raw: rawResponse, // Full LLM response text
                                data: structuredData, // Parsed/structured data if available
                                artefactRefs: outputCtx.artefactRefs || null,
                              },
                              errorMessage: step.errorMessage || null,
                              startedAt: step.startedAt,
                              completedAt: step.completedAt,
                            };
                          }),
                          executionLogs: executionLogs.map((log) => ({
                            timestamp: log.timestamp,
                            level: log.level,
                            stepIndex: log.stepIndex,
                            stepId: log.stepId,
                            message: log.message,
                            details: log.details || {},
                          })),
                        };
                        
                        const jsonOutput = JSON.stringify(output, null, 2);
                        await navigator.clipboard.writeText(jsonOutput);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch (err) {
                        console.error('Failed to copy output:', err);
                        setError('Failed to copy output to clipboard');
                      }
                    }}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: copied ? 'var(--color-success)' : 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    title="Copy formatted JSON output to clipboard"
                  >
                    {copied ? '✓ Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <div
                  style={{
                    maxHeight: '500px',
                    overflowY: 'auto',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--spacing-md)',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'var(--color-text)',
                    }}
                  >
                    {JSON.stringify(
                      {
                        runId: runId || 'N/A',
                        status: runState.status,
                        goal: runState.goal,
                        currentStepIndex: runState.currentStepIndex,
                        completedAt: runState.steps[runState.steps.length - 1]?.completedAt || null,
                        steps: runState.steps.map((step) => {
                          // Extract full response from outputContext
                          const outputCtx = (step.outputContext as Record<string, unknown>) || {};
                          const rawResponse = outputCtx.raw || null;
                          const structuredData = outputCtx.data || null;
                          
                          return {
                            stepIndex: step.stepIndex,
                            status: step.status,
                            inputContext: step.inputContext || {},
                            outputContext: {
                              raw: rawResponse, // Full LLM response text
                              data: structuredData, // Parsed/structured data if available
                              artefactRefs: outputCtx.artefactRefs || null,
                            },
                            errorMessage: step.errorMessage || null,
                            startedAt: step.startedAt,
                            completedAt: step.completedAt,
                          };
                        }),
                        executionLogs: executionLogs.map((log) => ({
                          timestamp: log.timestamp,
                          level: log.level,
                          stepIndex: log.stepIndex,
                          stepId: log.stepId,
                          message: log.message,
                          details: log.details || {},
                        })),
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            )}

            {runId && (
              <div
                style={{
                  marginTop: 'var(--spacing-md)',
                  padding: 'var(--spacing-sm)',
                  background: 'var(--color-surface-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Run ID: {runId}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
