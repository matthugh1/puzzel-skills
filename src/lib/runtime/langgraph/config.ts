/**
 * LangGraph Configuration
 * Defines state schema and configuration for LangGraph workflow execution
 */

// State schema matching AgentRun structure
export interface WorkflowState {
  runId: string;
  status: 'PLANNING' | 'RUNNING' | 'BLOCKED' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  goal: string;
  initialContext: Record<string, unknown>;
  plan: WorkflowPlan;
  currentStepIndex: number;
  steps: StepState[];
  artefacts: ArtefactState[];
  context: Record<string, unknown>; // Accumulated context from steps
  metadata?: Record<string, unknown>;
}

export interface WorkflowPlan {
  steps: WorkflowStep[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

export interface WorkflowStep {
  id: string;
  type: 'SKILL' | 'BRANCH' | 'MERGE' | 'ITERATOR' | 'WAIT' | 'APP_ACTION' | 'TASK' | 'DATA_INPUT';
  config: StepConfig;
  next?: string[]; // Array of next step IDs
}

export interface StepConfig {
  // SKILL step config
  skillId?: string;
  skillVersionId?: string;
  inputs?: Record<string, unknown>;
  description?: string;

  // BRANCH step config
  condition?: BranchCondition;
  paths?: BranchPath[];

  // MERGE step config
  mergeStrategy?: 'FIRST' | 'ALL' | 'LAST';

  // ITERATOR step config
  iteratorConfig?: {
    collectionPath: string; // JSONPath to collection
    stepId: string; // Step to execute for each item
  };

  // WAIT step config
  waitType?: 'DURATION' | 'UNTIL' | 'WEBHOOK';
  waitDuration?: number; // seconds
  waitUntil?: string; // ISO date string
  webhookPath?: string;

  // APP_ACTION step config
  appId?: string;
  actionId?: string;
  actionParams?: Record<string, unknown>;

  // TASK step config
  taskDescription?: string;
  assigneeId?: string;

  // DATA_INPUT step config
  inputSchema?: Record<string, unknown>;
}

export interface BranchCondition {
  type: 'JSONPATH' | 'AI' | 'MANUAL';
  expression?: string; // JSONPath expression
  aiPrompt?: string; // For AI-based branching
}

export interface BranchPath {
  condition: string; // Condition label or value
  nextStepId: string;
}

export interface StepState {
  stepId: string;
  stepIndex: number;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputContext: Record<string, unknown>;
  outputContext?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ArtefactState {
  id: string;
  stepId: string;
  type: string;
  content: Record<string, unknown>;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Checkpoint configuration
export interface CheckpointConfig {
  checkpointNamespace: string;
  checkpointId: string;
}

// State reducer (for updating state immutably)
export function reducer(state: WorkflowState, update: Partial<WorkflowState>): WorkflowState {
  return { ...state, ...update };
}
