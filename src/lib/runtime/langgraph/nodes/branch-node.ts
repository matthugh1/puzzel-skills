/**
 * Branch Step Node for LangGraph
 * Routes workflow execution based on conditions
 * Supports JSONPath conditions, AI-based selection, and manual selection
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep, BranchCondition, BranchPath } from '../config';
import { db } from '@/lib/db';

/**
 * Evaluate condition against state
 */
function evaluateCondition(condition: BranchCondition, state: WorkflowStateType): boolean {
  if (!condition) {
    return false;
  }

  // JSONPath-based condition evaluation
  if (condition.type === 'JSONPATH' && condition.expression) {
    try {
      const value = getValueFromPath(condition.expression, state.context);
      return Boolean(value);
    } catch {
      return false;
    }
  }

  // Simple comparison conditions (can be extended)
  // For now, JSONPath is the primary method
  return false;
}

/**
 * Evaluate AI-based path selection
 * Uses LLM to choose path based on context
 */
async function evaluateAIPathSelection(
  condition: BranchCondition,
  paths: BranchPath[],
  state: WorkflowStateType
): Promise<BranchPath> {
  // TODO: Implement AI-based path selection using LLM
  // For MVP, fall back to first path
  // In production, would call LLM with context and path descriptions
  return paths[0] || paths.find((p) => !p.condition) || paths[0];
}

/**
 * Request manual path selection
 * Uses LangGraph interrupt to pause and wait for user input
 */
async function requestManualPathSelection(
  stepId: string,
  paths: BranchPath[],
  state: WorkflowStateType
): Promise<BranchPath> {
  // Get run to find user
  const run = await db.agentRun.findUnique({
    where: { id: state.runId },
    select: { userId: true },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  // Create RunPath record for manual selection
  const runPath = await db.runPath.create({
    data: {
      runId: state.runId,
      stepIndex: state.currentStepIndex,
      branchStepId: stepId,
      pathOptions: paths.map((p) => ({
        id: p.nextStepId,
        label: p.condition || 'default',
      })),
      status: 'PENDING',
    },
  });

  // Update run status to BLOCKED
  await db.agentRun.update({
    where: { id: state.runId },
    data: {
      status: 'BLOCKED',
      blockedReason: `Manual branch selection required for step ${stepId}`,
      metadata: {
        ...(state.metadata || {}),
        blockedPathSelectionId: runPath.id,
      },
    },
  });

  // Throw error to trigger LangGraph interrupt (handled by executor)
  throw new Error('MANUAL_BRANCH_SELECTION_REQUIRED');
}

/**
 * Get value from JSONPath expression (simplified)
 */
function getValueFromPath(path: string, context: Record<string, unknown>): unknown {
  // Remove $ prefix if present
  const cleanPath = path.replace(/^\$\.?/, '');
  const parts = cleanPath.split('.');
  let current: unknown = context;
  for (const part of parts) {
    if (typeof current === 'object' && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function createBranchNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { condition, paths } = step.config as {
      condition?: BranchCondition;
      paths?: BranchPath[];
    };

    if (!paths || paths.length === 0) {
      throw new Error('Branch step missing paths');
    }

    let selectedPath: BranchPath | null = null;

    // Evaluate conditions based on type
    if (condition?.type === 'AI') {
      // AI-based path selection
      selectedPath = await evaluateAIPathSelection(condition, paths, state);
    } else if (condition?.type === 'MANUAL') {
      // Manual path selection - uses interrupt
      selectedPath = await requestManualPathSelection(step.id, paths, state);
    } else {
      // Evaluate conditions
      for (const path of paths) {
        if (!path.condition) {
          // Default path (no condition)
          if (!selectedPath) {
            selectedPath = path;
          }
          continue;
        }

        if (evaluateCondition(path.condition, state)) {
          selectedPath = path;
          break;
        }
      }
    }

    // If no path matched, use default or first path
    if (!selectedPath) {
      selectedPath = paths.find((p) => !p.condition) || paths[0];
    }

    // Update state with selected path
    return {
      currentStepIndex: state.currentStepIndex + 1,
      steps: [
        ...state.steps,
        {
          stepId: step.id,
          stepIndex: state.currentStepIndex,
          type: 'BRANCH',
          status: 'SUCCESS',
          inputContext: {},
          outputContext: {
            selectedPath: selectedPath.nextStepId,
          },
          completedAt: new Date(),
        },
      ],
      context: {
        ...state.context,
        [`step_${state.currentStepIndex}_selected_path`]: selectedPath.nextStepId,
      },
    };
  };
}
