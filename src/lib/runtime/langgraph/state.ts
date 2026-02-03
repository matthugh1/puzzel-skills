/**
 * LangGraph State Schema and Persistence
 * Defines state annotation and database checkpoint adapter
 */

import { Annotation } from '@langchain/langgraph';
import type { Checkpoint } from '@langchain/langgraph';
import { db } from '@/lib/db';
import type { AgentRun } from '@prisma/client';
import type { WorkflowPlan } from './config';

// Define state annotation for LangGraph
export const workflowStateAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  status: Annotation<'PLANNING' | 'RUNNING' | 'BLOCKED' | 'COMPLETE' | 'FAILED' | 'CANCELLED'>(),
  goal: Annotation<string>(),
  initialContext: Annotation<Record<string, unknown>>(),
  plan: Annotation<Record<string, unknown>>(), // WorkflowPlan
  currentStepIndex: Annotation<number>(),
  steps: Annotation<Array<Record<string, unknown>>>(),
  artefacts: Annotation<Array<Record<string, unknown>>>(),
  context: Annotation<Record<string, unknown>>(), // Accumulated context
  metadata: Annotation<Record<string, unknown> | undefined>(), // Optional field
});

export type WorkflowStateType = typeof workflowStateAnnotation.State;

// Checkpoint adapter interface
export interface CheckpointAdapter {
  save(state: WorkflowStateType, checkpointId: string): Promise<void>;
  load(runId: string): Promise<WorkflowStateType | null>;
}

// Database checkpoint adapter
export class DatabaseCheckpointAdapter implements CheckpointAdapter {
  async save(state: WorkflowStateType, checkpointId: string): Promise<void> {
    await db.agentRun.update({
      where: { id: state.runId },
      data: {
        status: state.status,
        currentStepIndex: state.currentStepIndex,
        plan: state.plan,
        metadata: {
          ...(state.metadata || {}),
          langgraphState: state, // Store full state in metadata
          checkpointId,
        },
      },
    });
  }

  async load(runId: string): Promise<WorkflowStateType | null> {
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        goal: true,
        initialContext: true,
        plan: true,
        currentStepIndex: true,
        metadata: true,
      },
    });

    if (!run) {
      return null;
    }

    // Try to load from metadata first (if checkpoint exists)
    if (run.metadata && typeof run.metadata === 'object' && 'langgraphState' in run.metadata) {
      return (run.metadata as { langgraphState: WorkflowStateType }).langgraphState;
    }

    // Otherwise, initialize from run data
    return loadStateFromRun(run);
  }
}

// State loading adapter (initializes state from AgentRun)
export function loadStateFromRun(run: {
  id: string;
  status: string;
  goal: string;
  initialContext: unknown;
  plan: unknown;
  currentStepIndex: number;
  metadata?: unknown;
}): WorkflowStateType {
  return {
    runId: run.id,
    status: run.status as WorkflowStateType['status'],
    goal: run.goal,
    initialContext: (run.initialContext as Record<string, unknown>) || {},
    plan: (run.plan as WorkflowPlan) || { steps: [] },
    currentStepIndex: run.currentStepIndex,
    steps: [], // Loaded separately from RunStep records
    artefacts: [], // Loaded separately from RunArtefact records
    context: (run.initialContext as Record<string, unknown>) || {},
    metadata: (run.metadata as Record<string, unknown>) || undefined,
  };
}
