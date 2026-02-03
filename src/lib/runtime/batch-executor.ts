/**
 * Batch Execution Logic
 * Executes multiple workflow runs in parallel with concurrency control
 */

import { db } from '@/lib/db';
import { executeWorkflow } from './langgraph/executor';

/**
 * Execute a batch run with concurrency control
 */
export async function executeBatchRun(
  batchId: string,
  runIds: string[],
  concurrency: number
): Promise<void> {
  // Update batch status to RUNNING
  await db.batchRun.update({
    where: { id: batchId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  // Execute runs with concurrency limit
  const executing: Promise<void>[] = [];
  let currentIndex = 0;

  async function executeNext(): Promise<void> {
    while (currentIndex < runIds.length) {
      const runId = runIds[currentIndex++];
      
      try {
        // Execute workflow (async, triggers execution but doesn't wait for completion)
        executeWorkflow(runId).catch((error) => {
          console.error(`Error executing run ${runId} in batch ${batchId}:`, error);
          
          // Mark run as failed
          db.agentRun.update({
            where: { id: runId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
            },
          }).catch(console.error);
          
          // Update batch progress
          updateBatchProgress(batchId).catch(console.error);
        });
        
        // Update batch progress periodically while waiting
        const progressInterval = setInterval(() => {
          updateBatchProgress(batchId).catch(console.error);
        }, 2000);
        
        // Wait for run to complete (poll status)
        while (true) {
          const run = await db.agentRun.findUnique({
            where: { id: runId },
            select: { status: true },
          });
          
          if (
            run &&
            (run.status === 'COMPLETE' || run.status === 'FAILED' || run.status === 'CANCELLED')
          ) {
            clearInterval(progressInterval);
            await updateBatchProgress(batchId);
            break;
          }
          
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second
        }
      } catch (error) {
        console.error(`Error executing run ${runId} in batch ${batchId}:`, error);
        
        // Mark run as failed
        await db.agentRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
          },
        }).catch(console.error);
        
        // Update batch progress
        await updateBatchProgress(batchId);
      }
    }
  }

  // Start concurrent executions
  for (let i = 0; i < Math.min(concurrency, runIds.length); i++) {
    executing.push(executeNext());
  }

  // Wait for all executions to complete
  await Promise.all(executing);

  // Final batch status update
  await finalizeBatch(batchId);
}

/**
 * Update batch progress (completed/failed counts)
 */
async function updateBatchProgress(batchId: string): Promise<void> {
  const batch = await db.batchRun.findUnique({
    where: { id: batchId },
    include: {
      runs: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!batch) return;

  const completedItems = batch.runs.filter(
    (r) => r.status === 'COMPLETE'
  ).length;
  const failedItems = batch.runs.filter((r) => r.status === 'FAILED').length;

  await db.batchRun.update({
    where: { id: batchId },
    data: {
      completedItems,
      failedItems,
    },
  });
}

/**
 * Finalize batch status when all runs complete
 */
async function finalizeBatch(batchId: string): Promise<void> {
  const batch = await db.batchRun.findUnique({
    where: { id: batchId },
    include: {
      runs: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!batch) return;

  const allComplete = batch.runs.every(
    (r) => r.status === 'COMPLETE' || r.status === 'FAILED' || r.status === 'CANCELLED'
  );

  if (allComplete) {
    const hasFailures = batch.runs.some((r) => r.status === 'FAILED');
    const allFailed = batch.runs.every((r) => r.status === 'FAILED' || r.status === 'CANCELLED');

    await db.batchRun.update({
      where: { id: batchId },
      data: {
        status: allFailed ? 'FAILED' : hasFailures ? 'COMPLETE' : 'COMPLETE',
        completedAt: new Date(),
        ...(allFailed && { failedAt: new Date() }),
      },
    });
  }
}
