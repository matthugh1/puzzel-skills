/**
 * Iterator Step Node for LangGraph
 * Executes a step for each item in a collection
 * Supports sequential and parallel execution
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';

/**
 * Get value from JSONPath expression (simplified)
 */
function getValueFromPath(path: string, context: Record<string, unknown>): unknown {
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

export function createIteratorNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { iteratorConfig } = step.config as {
      iteratorConfig?: {
        collectionPath: string;
        stepId: string;
        parallel?: boolean; // Execute iterations in parallel
        maxConcurrency?: number; // Max parallel executions
      };
    };

    if (!iteratorConfig) {
      throw new Error('Iterator step missing iteratorConfig');
    }

    // Get collection from context using JSONPath
    const collection = getValueFromPath(iteratorConfig.collectionPath, state.context);

    if (!Array.isArray(collection)) {
      throw new Error(`Iterator collection at ${iteratorConfig.collectionPath} is not an array`);
    }

    if (collection.length === 0) {
      // Empty collection - skip iteration
      return {
        currentStepIndex: state.currentStepIndex + 1,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'ITERATOR',
            status: 'SUCCESS',
            inputContext: {
              collectionPath: iteratorConfig.collectionPath,
              collectionSize: 0,
            },
            outputContext: {
              iterationCount: 0,
              skipped: true,
            },
            completedAt: new Date(),
          },
        ],
      };
    }

    // Iterator node prepares for iteration
    // LangGraph will handle the actual iteration by calling the step for each item
    const parallel = iteratorConfig.parallel || false;
    const maxConcurrency = iteratorConfig.maxConcurrency || 5;

    return {
      currentStepIndex: state.currentStepIndex + 1,
      steps: [
        ...state.steps,
        {
          stepId: step.id,
          stepIndex: state.currentStepIndex,
          type: 'ITERATOR',
          status: 'RUNNING',
          inputContext: {
            collectionPath: iteratorConfig.collectionPath,
            collectionSize: collection.length,
            parallel,
            maxConcurrency,
          },
          outputContext: {
            iterationCount: collection.length,
            parallel,
          },
          startedAt: new Date(),
        },
      ],
      context: {
        ...state.context,
        [`step_${state.currentStepIndex}_iterator`]: {
          collectionPath: iteratorConfig.collectionPath,
          stepId: iteratorConfig.stepId,
          items: collection,
          parallel,
          maxConcurrency,
          currentIndex: 0,
          results: [],
        },
      },
    };
  };
}
