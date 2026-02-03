/**
 * Wait Step Node for LangGraph
 * Pauses workflow execution for a duration or until a condition
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';

export function createWaitNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { waitType, waitDuration, waitUntil, webhookPath } = step.config as {
      waitType?: 'DURATION' | 'UNTIL' | 'WEBHOOK';
      waitDuration?: number;
      waitUntil?: string;
      webhookPath?: string;
    };

    const waitTypeValue = waitType || 'DURATION';

    // Wait node marks workflow as BLOCKED and stores wait info
    // The workflow will be resumed by a worker when the wait condition is met
    const waitInfo: Record<string, unknown> = {
      waitType: waitTypeValue,
    };

    if (waitTypeValue === 'DURATION' && waitDuration) {
      // Calculate wait until time
      const waitUntilDate = new Date(Date.now() + waitDuration * 1000);
      waitInfo.waitUntil = waitUntilDate.toISOString();
    } else if (waitTypeValue === 'UNTIL' && waitUntil) {
      waitInfo.waitUntil = waitUntil;
    } else if (waitTypeValue === 'WEBHOOK' && webhookPath) {
      waitInfo.webhookPath = webhookPath;
    } else {
      throw new Error('Wait step missing required configuration');
    }

    // Update state to BLOCKED and store wait info
    return {
      status: 'BLOCKED' as const,
      currentStepIndex: state.currentStepIndex + 1,
      steps: [
        ...state.steps,
        {
          stepId: step.id,
          stepIndex: state.currentStepIndex,
          type: 'WAIT',
          status: 'RUNNING',
          inputContext: {},
          outputContext: waitInfo,
          startedAt: new Date(),
        },
      ],
      metadata: {
        ...state.metadata,
        waitInfo,
      },
    };
  };
}
