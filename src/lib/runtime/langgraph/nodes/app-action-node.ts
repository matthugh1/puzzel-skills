/**
 * App Action Step Node for LangGraph
 * Executes an app integration action within a workflow
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';
import { resolveContext } from '../../context-resolver';
import { db } from '@/lib/db';
import { createIntegrationAdapter } from '@/lib/integrations/registry';
import { decrypt } from '@/lib/encryption';

export function createAppActionNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { appId, actionId, actionParams } = step.config;

    if (!appId || !actionId) {
      throw new Error('App action step missing appId or actionId');
    }

    // Get run to find user
    const run = await db.agentRun.findUnique({
      where: { id: state.runId },
      select: { userId: true },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Load user's integration
    const integration = await db.appIntegration.findUnique({
      where: {
        userId_appName: {
          userId: run.userId,
          appName: appId,
        },
      },
    });

    if (!integration || integration.status !== 'CONNECTED') {
      return {
        status: 'FAILED' as const,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'APP_ACTION',
            status: 'FAILED',
            inputContext: actionParams || {},
            errorMessage: `Integration ${appId} not connected`,
            completedAt: new Date(),
          },
        ],
      };
    }

    // Resolve input context
    const previousSteps = state.steps.map((s) => ({
      stepIndex: s.stepIndex as number,
      outputContext: (s.outputContext as Record<string, unknown>) || null,
    }));

    const resolvedParams = await resolveContext(
      (actionParams as Record<string, unknown>) || {},
      state.initialContext,
      previousSteps
    );

    // Create step record
    const runStep = await db.runStep.create({
      data: {
        runId: state.runId,
        stepIndex: state.currentStepIndex,
        status: 'RUNNING',
        inputContext: resolvedParams,
        startedAt: new Date(),
      },
    });

    try {
      // Decrypt credentials
      const credentialsData = (integration.credentials as { encrypted?: string })?.encrypted;
      if (!credentialsData) {
        throw new Error('Integration credentials not found');
      }

      const decrypted = decrypt(credentialsData);
      const credentials = JSON.parse(decrypted);

      // Create adapter and connect
      const adapter = createIntegrationAdapter(appId as 'gmail' | 'slack');
      await adapter.connect(credentials);

      // Execute action
      const output = await adapter.executeAction(actionId, resolvedParams);

      // Disconnect adapter
      await adapter.disconnect();

      // Update step
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'SUCCESS',
          outputContext: output,
          completedAt: new Date(),
        },
      });

      // Update state
      return {
        currentStepIndex: state.currentStepIndex + 1,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'APP_ACTION',
            status: 'SUCCESS',
            inputContext: resolvedParams,
            outputContext: output,
            completedAt: new Date(),
          },
        ],
        context: {
          ...state.context,
          [`step_${state.currentStepIndex}_output`]: output,
          [`app_${appId}_${actionId}`]: output,
        },
      };
    } catch (error) {
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });

      return {
        status: 'FAILED' as const,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'APP_ACTION',
            status: 'FAILED',
            inputContext: resolvedParams,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        ],
      };
    }
  };
}
