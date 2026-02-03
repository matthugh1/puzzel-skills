/**
 * Wait Condition Checker
 * Background worker that checks wait conditions and resumes workflows
 */

import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

// Run every 30 seconds
const WAIT_CHECK_INTERVAL = 30000;

/**
 * Start wait checker (runs periodically)
 */
export function startWaitChecker(): void {
  setInterval(async () => {
    await checkWaitConditions();
  }, WAIT_CHECK_INTERVAL);
}

/**
 * Check wait conditions and resume workflows
 */
export async function checkWaitConditions(): Promise<void> {
  try {
    // Find runs that are BLOCKED with wait info
    const blockedRuns = await db.agentRun.findMany({
      where: {
        status: 'BLOCKED',
        metadata: {
          path: ['waitInfo'],
          not: null,
        },
      },
    });

    const now = new Date();

    for (const run of blockedRuns) {
      const metadata = run.metadata as { waitInfo?: Record<string, unknown> } | null;
      if (!metadata?.waitInfo) {
        continue;
      }

      const waitInfo = metadata.waitInfo;
      const waitType = waitInfo.waitType as string;
      const waitUntil = waitInfo.waitUntil as string | undefined;

      let shouldResume = false;

      switch (waitType) {
        case 'DURATION':
        case 'UNTIL':
          // Time-based wait - check if time has passed
          if (waitUntil && new Date(waitUntil) <= now) {
            shouldResume = true;
          }
          break;

        case 'WEBHOOK':
          // Webhook-based wait - check if webhook received
          // This would be handled by a separate webhook endpoint
          // For now, we'll check if a webhook was received (stored in metadata)
          const webhookReceived = waitInfo.webhookReceived as boolean | undefined;
          if (webhookReceived) {
            shouldResume = true;
          }
          break;

        default:
          // Unknown wait type
          continue;
      }

      if (shouldResume) {
        // Resume workflow
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'RUNNING',
            blockedReason: null,
            metadata: {
              ...metadata,
              waitInfo: {
                ...waitInfo,
                resumedAt: new Date().toISOString(),
              },
            },
          },
        });

        // Trigger execution
        executeWorkflow(run.id).catch((error) => {
          console.error(`Wait resume execution error for ${run.id}:`, error);
          db.agentRun.update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
            },
          }).catch(console.error);
        });
      } else if (waitUntil && new Date(waitUntil) < now) {
        // Timeout reached
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            blockedReason: 'Wait timeout exceeded',
          },
        });
      }
    }
  } catch (error) {
    console.error('Wait checker error:', error);
  }
}
