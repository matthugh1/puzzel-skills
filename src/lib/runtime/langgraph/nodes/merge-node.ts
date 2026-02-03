/**
 * Merge Step Node for LangGraph
 * Merges multiple execution paths with different strategies
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';

/**
 * Merge contexts based on strategy
 */
function mergeContexts(
  contexts: Array<Record<string, unknown>>,
  strategy: 'FIRST' | 'ALL' | 'LAST'
): Record<string, unknown> {
  if (contexts.length === 0) {
    return {};
  }

  switch (strategy) {
    case 'FIRST':
      // Use context from first completed path
      return contexts[0] || {};
    case 'LAST':
      // Use context from last completed path
      return contexts[contexts.length - 1] || {};
    case 'ALL':
      // Merge all contexts (later values override earlier ones)
      return Object.assign({}, ...contexts);
    default:
      return Object.assign({}, ...contexts);
  }
}

export function createMergeNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { mergeStrategy } = step.config as { mergeStrategy?: 'FIRST' | 'ALL' | 'LAST' };

    // Merge strategy determines how to combine context from multiple paths
    const strategy = mergeStrategy || 'ALL';

    // Collect contexts from all incoming paths
    // In LangGraph, multiple paths converging on a merge node will have their states combined
    // We extract contexts from previous steps that lead to this merge
    const incomingContexts: Array<Record<string, unknown>> = [];

    // Find steps that should feed into this merge
    // This is simplified - in production, would track which paths completed
    const previousSteps = state.steps.filter(
      (s) => s.stepIndex < state.currentStepIndex && s.status === 'SUCCESS'
    );

    for (const prevStep of previousSteps) {
      if (prevStep.outputContext) {
        incomingContexts.push(prevStep.outputContext as Record<string, unknown>);
      }
    }

    // Merge contexts according to strategy
    const mergedContext = mergeContexts(incomingContexts, strategy);

    return {
      currentStepIndex: state.currentStepIndex + 1,
      steps: [
        ...state.steps,
        {
          stepId: step.id,
          stepIndex: state.currentStepIndex,
          type: 'MERGE',
          status: 'SUCCESS',
          inputContext: {},
          outputContext: {
            mergeStrategy: strategy,
            mergedContext,
            incomingPathCount: incomingContexts.length,
          },
          completedAt: new Date(),
        },
      ],
      context: {
        ...state.context,
        [`step_${state.currentStepIndex}_merged`]: mergedContext,
      },
    };
  };
}
