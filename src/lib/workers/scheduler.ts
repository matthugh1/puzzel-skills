/**
 * Scheduled Trigger Worker
 * Checks scheduled triggers and executes workflows
 */

import cron from 'node-cron';
import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

/**
 * Start scheduler (runs every minute)
 */
export function startScheduler(): void {
  // Run every minute
  const SCHEDULE_CHECK_INTERVAL = '* * * * *'; // Cron: every minute

  cron.schedule(SCHEDULE_CHECK_INTERVAL, async () => {
    await checkAndTriggerScheduledWorkflows();
  });
}

/**
 * Check and trigger scheduled workflows
 */
export async function checkAndTriggerScheduledWorkflows(): Promise<void> {
  try {
    // Find active scheduled triggers
    const triggers = await db.workflowTrigger.findMany({
      where: {
        triggerType: 'SCHEDULED',
        status: 'ACTIVE',
      },
      include: {
        workflow: true,
      },
    });

    const now = new Date();

    for (const trigger of triggers) {
      if (!trigger.workflow || trigger.workflow.status !== 'PUBLISHED') {
        continue;
      }

      const config = trigger.config as {
        cronExpression?: string;
        timezone?: string;
        initialContext?: Record<string, unknown>;
      };

      if (!config.cronExpression) {
        continue;
      }

      // Check if trigger should fire now
      if (shouldTriggerNow(config.cronExpression, trigger.lastTriggeredAt, now)) {
        try {
          // Create AgentRun
          const run = await db.agentRun.create({
            data: {
              workflowId: trigger.workflowId,
              userId: trigger.workflow.ownerId,
              goal: `Scheduled: ${trigger.workflow.name}`,
              initialContext: config.initialContext || {},
              status: 'RUNNING',
              plan: trigger.workflow.plan,
            },
          });

          // Trigger execution
          executeWorkflow(run.id).catch((error) => {
            console.error(`Scheduled trigger execution error for ${trigger.id}:`, error);
            // Update trigger status to ERROR
            db.workflowTrigger.update({
              where: { id: trigger.id },
              data: {
                status: 'ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
              },
            }).catch(console.error);
          });

          // Update last triggered time
          await db.workflowTrigger.update({
            where: { id: trigger.id },
            data: {
              lastTriggeredAt: now,
              status: 'ACTIVE', // Reset error status if it was in error
              errorMessage: null,
            },
          });
        } catch (error) {
          console.error(`Error triggering scheduled workflow ${trigger.id}:`, error);
          await db.workflowTrigger.update({
            where: { id: trigger.id },
            data: {
              status: 'ERROR',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}

/**
 * Check if cron expression should trigger now
 */
function shouldTriggerNow(
  cronExpression: string,
  lastTriggeredAt: Date | null,
  now: Date
): boolean {
  try {
    // Parse cron expression
    const cronTime = cron.parseExpression(cronExpression, {
      tz: 'UTC', // Default to UTC, can be configured per trigger
    });

    // Get next scheduled time
    const nextTime = cronTime.next().toDate();

    // Check if next time is within the current minute
    const timeDiff = nextTime.getTime() - now.getTime();
    return timeDiff >= 0 && timeDiff < 60000; // Within 1 minute
  } catch (error) {
    console.error(`Invalid cron expression: ${cronExpression}`, error);
    return false;
  }
}
