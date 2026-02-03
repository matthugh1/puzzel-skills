/**
 * Task Step Node for LangGraph
 * Creates a human task and pauses workflow execution
 */

import type { WorkflowStateType } from '../state';
import type { WorkflowStep } from '../config';
import { db } from '@/lib/db';

export function createTaskNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { taskDescription, assigneeId } = step.config;

    if (!taskDescription) {
      throw new Error('Task step missing taskDescription');
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
    const taskAssigneeId = assigneeId || run.userId;

    // Create task record
    const task = await db.runTask.create({
      data: {
        runId: state.runId,
        stepIndex: state.currentStepIndex,
        title: taskDescription as string,
        description: step.config.description as string | undefined,
        assigneeId: taskAssigneeId,
        status: 'PENDING',
      },
    });

    // Update run status to BLOCKED
    await db.agentRun.update({
      where: { id: state.runId },
      data: {
        status: 'BLOCKED',
        blockedReason: `Waiting for task completion: ${task.id}`,
        metadata: {
          ...((state.metadata as Record<string, unknown>) || {}),
          blockedTaskId: task.id,
        },
      },
    });

    // Throw error to trigger LangGraph interrupt (handled by executor)
    throw new Error('TASK_COMPLETION_REQUIRED');
  };
}
