/**
 * LangGraph Workflow Executor
 * Executes workflows using LangGraph state machine
 */

import { MemorySaver } from '@langchain/langgraph';
import { buildWorkflowGraph } from './graph-builder';
import { loadStateFromRun } from './state';
import { db } from '@/lib/db';
import { acquireLease, releaseLease } from '../lease-manager';
import type { WorkflowPlan } from './config';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

/**
 * Execute workflow using LangGraph
 */
export async function executeWorkflow(runId: string): Promise<void> {
  // Use distinctive prefix to stand out from Prisma logs
  const PREFIX = '🚀 WORKFLOW-EXECUTOR';
  const logMsg = `${PREFIX} [${WORKER_ID}] Starting execution for run ${runId}`;
  
  // Log to both console.error and console.log for maximum visibility
  console.error('\n' + '='.repeat(80));
  console.error(logMsg);
  console.error('='.repeat(80) + '\n');
  console.log('\n' + '='.repeat(80));
  console.log(logMsg);
  console.log('='.repeat(80) + '\n');
  
  // Also write directly to stderr as fallback
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write('\n' + '='.repeat(80) + '\n');
    process.stderr.write(logMsg + '\n');
    process.stderr.write('='.repeat(80) + '\n\n');
  }
  
  // Acquire lease
  console.error(`${PREFIX} [${WORKER_ID}] Acquiring lease for run ${runId}`);
  const leaseAcquired = await acquireLease(runId, WORKER_ID, 300);
  console.error(`${PREFIX} [${WORKER_ID}] Lease acquired: ${leaseAcquired}`);
  if (!leaseAcquired) {
    const error = new Error('Could not acquire run lease');
    console.error(`${PREFIX} [${WORKER_ID}] Failed to acquire lease for run ${runId}:`, error);
    await updateRunWithError(runId, error);
    throw error;
  }

  try {
    // Load run
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      include: { workflow: true },
    });

    if (!run) {
      const error = new Error(`Run not found: ${runId}`);
      console.error(`${PREFIX} [${WORKER_ID}] ${error.message}`);
      await updateRunWithError(runId, error);
      throw error;
    }
    console.error(`${PREFIX} [${WORKER_ID}] Loaded run ${runId}, status: ${run.status}, workflow: ${run.workflow.name}`);

    // Check cancellation
    if (run.status === 'CANCELLED') {
      console.error(`${PREFIX} [${WORKER_ID}] Run ${runId} is cancelled, aborting execution`);
      return;
    }

    // Load state from run
    console.error(`${PREFIX} [${WORKER_ID}] Loading initial state for run ${runId}`);
    let initialState;
    try {
      initialState = loadStateFromRun(run);
      console.error(`${PREFIX} [${WORKER_ID}] Initial state loaded:`, {
        status: initialState.status,
        currentStepIndex: initialState.currentStepIndex,
        stepsCount: initialState.steps?.length || 0,
      });
    } catch (stateError) {
      const error = new Error(`Failed to load initial state: ${stateError instanceof Error ? stateError.message : String(stateError)}`);
      console.error(`${PREFIX} [${WORKER_ID}] ❌ ERROR loading initial state:`, stateError);
      await updateRunWithError(runId, error);
      throw error;
    }

    // Build LangGraph workflow
    console.error(`${PREFIX} [${WORKER_ID}] Building workflow graph for run ${runId}`);
    console.error(`${PREFIX} [${WORKER_ID}] Plan structure:`, JSON.stringify(run.plan, null, 2));
    let graph, interruptNodes;
    try {
      const graphResult = buildWorkflowGraph(run.plan as WorkflowPlan);
      graph = graphResult.graph;
      interruptNodes = graphResult.interruptNodes;
      console.error(`${PREFIX} [${WORKER_ID}] Graph built with ${interruptNodes.length} interrupt nodes`);
    } catch (graphError) {
      const error = new Error(`Failed to build workflow graph: ${graphError instanceof Error ? graphError.message : String(graphError)}`);
      console.error(`${PREFIX} [${WORKER_ID}] ❌ ERROR building graph:`, graphError);
      console.error(`${PREFIX} [${WORKER_ID}] Graph error stack:`, graphError instanceof Error ? graphError.stack : 'No stack');
      await updateRunWithError(runId, error);
      throw error;
    }

    // Use MemorySaver for checkpointing (MVP - can be replaced with DatabaseCheckpointAdapter later)
    const checkpointer = new MemorySaver();

    // Compile graph with checkpointing
    // Only interrupt before nodes that actually exist in the graph
    console.error(`${PREFIX} [${WORKER_ID}] Compiling graph for run ${runId}`);
    const compiledGraph = graph.compile({
      checkpointer,
      interruptBefore: interruptNodes.length > 0 ? interruptNodes : undefined,
    });
    console.error(`${PREFIX} [${WORKER_ID}] ✅ Graph compiled successfully`);

    // Execute workflow
    const config = {
      configurable: {
        thread_id: runId, // Use runId as thread ID
      },
    };

    // Stream execution (for real-time updates)
    console.error(`${PREFIX} [${WORKER_ID}] Starting workflow stream execution for run ${runId}`);
    const stream = await compiledGraph.stream(initialState, config);

    let eventCount = 0;
    for await (const event of stream) {
      eventCount++;
      const eventKeys = Object.keys(event);
      console.error(`${PREFIX} [${WORKER_ID}] 📨 Received event ${eventCount} for run ${runId}:`, eventKeys);
      
      // Log full event structure for debugging (truncated)
      const eventPreview = JSON.stringify(event, null, 2).substring(0, 1000);
      console.error(`${PREFIX} [${WORKER_ID}] Event preview: ${eventPreview}...`);
      
      // Update database with state changes
      try {
        await syncStateToDatabase(runId, event);
      } catch (syncError) {
        console.error(`${PREFIX} [${WORKER_ID}] ❌ Error syncing state to database for run ${runId}:`, syncError);
        // Continue execution even if sync fails
      }
    }

    console.error(`${PREFIX} [${WORKER_ID}] ✅ Workflow execution completed for run ${runId} (${eventCount} events processed)`);
    
    // Final status check - ensure run is marked as complete if execution finished
    const finalRun = await db.agentRun.findUnique({ where: { id: runId } });
    if (finalRun && finalRun.status === 'RUNNING') {
      console.error(`${PREFIX} [${WORKER_ID}] Run ${runId} still in RUNNING status after execution, updating to COMPLETE`);
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETE',
          completedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error(`\n${PREFIX} [${WORKER_ID}] ❌❌❌ WORKFLOW EXECUTION ERROR for run ${runId} ❌❌❌`);
    console.error(`${PREFIX} [${WORKER_ID}] Error:`, error);
    console.error(`${PREFIX} [${WORKER_ID}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    console.error('='.repeat(80) + '\n');
    
    // Update run with error details
    await updateRunWithError(runId, error);
    
    // Re-throw to allow caller to handle if needed
    throw error;
  } finally {
    // Release lease
    const PREFIX = '🚀 WORKFLOW-EXECUTOR';
    console.error(`${PREFIX} [${WORKER_ID}] Releasing lease for run ${runId}`);
    await releaseLease(runId, WORKER_ID);
    
    // Clean up temporary files (even on error)
    try {
      const { cleanupRunFiles } = await import('@/lib/file-storage');
      await cleanupRunFiles(runId);
    } catch (cleanupError) {
      console.error(`${PREFIX} [${WORKER_ID}] Error cleaning up files for run ${runId}:`, cleanupError);
      // Don't throw - cleanup failures shouldn't break error handling
    }
  }
}

/**
 * Update run status to FAILED with error details
 */
async function updateRunWithError(runId: string, error: unknown): Promise<void> {
  const PREFIX = '🚀 WORKFLOW-EXECUTOR';
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error(`${PREFIX} [${WORKER_ID}] Updating run ${runId} with error:`, errorMessage);
    
    await db.agentRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        metadata: {
          error: errorMessage,
          errorStack,
          failedAt: new Date().toISOString(),
        } as Record<string, unknown>,
      },
    });
    
    console.error(`${PREFIX} [${WORKER_ID}] ✅ Successfully updated run ${runId} status to FAILED`);
  } catch (updateError) {
    const PREFIX = '🚀 WORKFLOW-EXECUTOR';
    console.error(`${PREFIX} [${WORKER_ID}] ❌ Failed to update run ${runId} with error:`, updateError);
    // Don't throw - we've already logged the error
  }
}

/**
 * Sync LangGraph state to database
 */
async function syncStateToDatabase(
  runId: string,
  event: { [key: string]: unknown }
): Promise<void> {
  const PREFIX = '🚀 WORKFLOW-EXECUTOR';
  try {
    // Extract state from event
    // LangGraph events have structure: { node_name: state }
    const stateKeys = Object.keys(event);
    if (stateKeys.length === 0) {
      console.error(`${PREFIX} [${WORKER_ID}] Empty event received for run ${runId}, skipping sync`);
      return;
    }

    console.error(`${PREFIX} [${WORKER_ID}] Event keys: ${stateKeys.join(', ')}`);
    console.error(`${PREFIX} [${WORKER_ID}] Event data:`, JSON.stringify(event, null, 2).substring(0, 500));

    // Get the state from the event (usually the last node's state)
    const state = event[stateKeys[stateKeys.length - 1]] as typeof loadStateFromRun extends (
      run: unknown
    ) => infer R
      ? R
      : never;

    if (!state || typeof state !== 'object') {
      console.error(`${PREFIX} [${WORKER_ID}] Invalid state in event for run ${runId}, skipping sync`);
      return;
    }

    // Extract status - handle both direct status and status from state
    const status = (state as { status?: string }).status || 'RUNNING';
    const currentStepIndex = (state as { currentStepIndex?: number }).currentStepIndex ?? 0;
    const steps = (state as { steps?: unknown[] }).steps || [];

    console.error(`${PREFIX} [${WORKER_ID}] Extracted state: status=${status}, stepIndex=${currentStepIndex}, stepsCount=${steps.length}`);

    // Get current run metadata to preserve execution logs
    const currentRun = await db.agentRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });

    const currentMetadata = (currentRun?.metadata as Record<string, unknown>) || {};
    const executionLogs = currentMetadata.executionLogs || [];

    // Update AgentRun - preserve execution logs and other metadata
    await db.agentRun.update({
      where: { id: runId },
      data: {
        status: status as 'PLANNING' | 'RUNNING' | 'BLOCKED' | 'COMPLETE' | 'FAILED' | 'CANCELLED',
        currentStepIndex,
        metadata: {
          ...currentMetadata, // Preserve all existing metadata (including executionLogs)
          ...(state.metadata || {}), // Merge in LangGraph state metadata
          executionLogs, // Explicitly preserve execution logs
          langgraphState: state,
          lastSyncAt: new Date().toISOString(),
        },
      },
    });

    // Also ensure RunStep records are up to date by loading them
    // The skill node creates RunStep records, so we should verify they exist
    const runSteps = await db.runStep.findMany({
      where: { runId },
      orderBy: { stepIndex: 'asc' },
    });
    
    console.error(`${PREFIX} [${WORKER_ID}] Found ${runSteps.length} RunStep records in database`);
    
    console.error(`${PREFIX} [${WORKER_ID}] ✅ Synced state for run ${runId}: status=${status}, stepIndex=${currentStepIndex}, dbSteps=${runSteps.length}`);
  } catch (error) {
    console.error(`${PREFIX} [${WORKER_ID}] ❌ Error syncing state to database for run ${runId}:`, error);
    throw error; // Re-throw to allow caller to handle
  }
}
