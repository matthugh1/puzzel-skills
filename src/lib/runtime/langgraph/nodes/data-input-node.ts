/**
 * Data Input Step Node for LangGraph
 * Requests form input from user and pauses workflow execution
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';
import { db } from '@/lib/db';

export function createDataInputNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { inputSchema, assigneeId } = step.config;

    if (!inputSchema) {
      throw new Error('Data input step missing inputSchema');
    }

    // Get run to find user
    const run = await db.agentRun.findUnique({
      where: { id: state.runId },
      select: { userId: true },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Use assigneeId if provided, otherwise use run initiator
    const inputAssigneeId = assigneeId || run.userId;

    // Create data input request record
    const dataInput = await db.dataInputRequest.create({
      data: {
        runId: state.runId,
        stepIndex: state.currentStepIndex,
        inputSchema: inputSchema as Record<string, unknown>,
        requestedBy: run.userId,
        assigneeId: inputAssigneeId,
        status: 'PENDING',
      },
    });

    // Update run status to BLOCKED
    await db.agentRun.update({
      where: { id: state.runId },
      data: {
        status: 'BLOCKED',
        blockedReason: `Waiting for data input: ${dataInput.id}`,
        metadata: {
          ...((state.metadata as Record<string, unknown>) || {}),
          blockedDataInputId: dataInput.id,
        },
      },
    });

    // Throw error to trigger LangGraph interrupt (handled by executor)
    throw new Error('DATA_INPUT_REQUIRED');
  };
}
