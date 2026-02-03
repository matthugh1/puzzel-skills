/**
 * Execution Logger
 * Provides real-time execution logging for workflow debugging
 */

import { db } from '@/lib/db';

export interface ExecutionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  stepIndex?: number;
  stepId?: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Add execution log entry to run metadata
 */
export async function addExecutionLog(
  runId: string,
  entry: Omit<ExecutionLogEntry, 'timestamp'>
): Promise<void> {
  const logEntry: ExecutionLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  try {
    // Get current run to access metadata
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });

    if (!run) {
      console.error(`[ExecutionLogger] Run ${runId} not found`);
      return;
    }

    const metadata = (run.metadata as Record<string, unknown>) || {};
    const executionLogs = (metadata.executionLogs as ExecutionLogEntry[]) || [];

    // Add new log entry
    executionLogs.push(logEntry);

    // Keep only last 1000 entries to prevent metadata bloat
    const trimmedLogs = executionLogs.slice(-1000);

    // Update run metadata
    await db.agentRun.update({
      where: { id: runId },
      data: {
        metadata: {
          ...metadata,
          executionLogs: trimmedLogs,
          lastLogAt: new Date().toISOString(),
        },
      },
    });
    
    // Log to console for debugging
    console.log(`[ExecutionLogger] Added log entry to run ${runId}: ${logEntry.message} (${logEntry.level})`);
  } catch (error) {
    console.error(`[ExecutionLogger] Failed to add log entry for run ${runId}:`, error);
    // Don't throw - logging failures shouldn't break execution
  }
}

/**
 * Get execution logs for a run
 */
export async function getExecutionLogs(runId: string): Promise<ExecutionLogEntry[]> {
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { metadata: true },
  });

  if (!run || !run.metadata) {
    console.log(`[ExecutionLogger] No metadata found for run ${runId}`);
    return [];
  }

  const metadata = run.metadata as Record<string, unknown>;
  const logs = (metadata.executionLogs as ExecutionLogEntry[]) || [];
  console.log(`[ExecutionLogger] Retrieved ${logs.length} logs for run ${runId}, last log: ${logs[logs.length - 1]?.message || 'none'}`);
  return logs;
}
