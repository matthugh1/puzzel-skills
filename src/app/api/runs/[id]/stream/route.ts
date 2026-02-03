/**
 * GET /api/runs/:id/stream
 * Server-Sent Events stream for real-time workflow execution updates
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import type { AgentRun } from '@prisma/client';
import { getExecutionLogs } from '@/lib/runtime/execution-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Create readable stream for SSE
 */
function createReadableStream(runId: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastStepIndex = -1;
      let lastStatus: string | null = null;
      let isComplete = false;
      let lastLogCount = 0;
      let streamClosed = false;
      
      // Helper function to safely enqueue data
      const safeEnqueue = (data: string) => {
        if (!streamClosed && controller.desiredSize !== null) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (err) {
            console.error(`[SSE] Error enqueueing data for run ${runId}:`, err);
            streamClosed = true;
          }
        }
      };

      // Send initial state
      const run = await db.agentRun.findUnique({
        where: { id: runId },
        include: {
          steps: {
            orderBy: { stepIndex: 'asc' },
          },
        },
      });

      if (run) {
        const executionLogs = await getExecutionLogs(runId);
        lastLogCount = executionLogs.length;
        console.log(`[SSE] Initial state: Found ${executionLogs.length} execution logs for run ${runId}`);
        console.log(`[SSE] Log messages:`, executionLogs.map(l => l.message).join(', '));
        
        const initialData = {
          type: 'initial',
          run: {
            id: run.id,
            status: run.status,
            goal: run.goal,
            currentStepIndex: run.currentStepIndex,
            steps: run.steps.map((step) => ({
              id: step.id,
              stepIndex: step.stepIndex,
              status: step.status,
              startedAt: step.startedAt,
              completedAt: step.completedAt,
              errorMessage: step.errorMessage,
              inputContext: step.inputContext,
              outputContext: step.outputContext,
            })),
          },
          executionLogs, // Include execution logs in initial state
        };
        safeEnqueue(`data: ${JSON.stringify(initialData)}\n\n`);
        lastStepIndex = run.currentStepIndex;
        lastStatus = run.status;
      }

      // Poll for updates
      let consecutiveErrors = 0;
      const MAX_CONSECUTIVE_ERRORS = 5;
      
      const pollInterval = setInterval(async () => {
        try {
          const updatedRun = await db.agentRun.findUnique({
            where: { id: runId },
            include: {
              steps: {
                orderBy: { stepIndex: 'asc' },
              },
            },
          });

          if (!updatedRun) {
            console.log(`[SSE] Run ${runId} not found, closing stream`);
            clearInterval(pollInterval);
            if (!streamClosed) {
              streamClosed = true;
              controller.close();
            }
            return;
          }
          
          // Reset error counter on successful poll
          consecutiveErrors = 0;

          // Check for step updates - both new steps and status changes
          // Track step statuses to detect changes
          const currentStepStatuses = new Map(
            updatedRun.steps.map((s) => [`${s.stepIndex}`, s.status])
          );
          
          // Check for new steps or status changes
          const stepsToNotify = updatedRun.steps.filter((step) => {
            // New step (stepIndex > lastStepIndex)
            if (step.stepIndex > lastStepIndex) {
              return true;
            }
            // Status change for existing step (we'd need to track previous statuses)
            // For now, send updates for all steps that have completed or failed
            if (step.status === 'SUCCESS' || step.status === 'FAILED') {
              return true;
            }
            return false;
          });

          for (const step of stepsToNotify) {
            const stepData = {
              type: 'step_update',
              step: {
                id: step.id,
                stepIndex: step.stepIndex,
                status: step.status,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
                errorMessage: step.errorMessage,
                inputContext: step.inputContext,
                outputContext: step.outputContext,
              },
            };
            safeEnqueue(`data: ${JSON.stringify(stepData)}\n\n`);
          }
          
          // Update lastStepIndex to highest step index
          if (updatedRun.steps.length > 0) {
            const maxStepIndex = Math.max(...updatedRun.steps.map((s) => s.stepIndex));
            if (maxStepIndex > lastStepIndex) {
              lastStepIndex = maxStepIndex;
            }
          }
          
          // Also update if currentStepIndex changed
          if (updatedRun.currentStepIndex !== lastStepIndex) {
            lastStepIndex = updatedRun.currentStepIndex;
          }

          // Check for new execution logs (check more frequently for real-time updates)
          try {
            const currentLogs = await getExecutionLogs(runId);
            if (currentLogs.length > lastLogCount) {
              const newLogs = currentLogs.slice(lastLogCount);
              console.log(`[SSE] Found ${newLogs.length} new execution logs for run ${runId}`);
              for (const log of newLogs) {
                const logData = {
                  type: 'execution_log',
                  log,
                };
                safeEnqueue(`data: ${JSON.stringify(logData)}\n\n`);
              }
              lastLogCount = currentLogs.length;
            }
          } catch (logError) {
            // Log error but don't fail the entire poll - execution logs are optional
            const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
            console.error(`[SSE] Error fetching execution logs for run ${runId}:`, logErrorMessage);
            // Don't increment consecutiveErrors for execution log errors as they're non-critical
          }

          // Check for status updates
          if (updatedRun.status !== lastStatus) {
            const statusData: {
              type: string;
              status: string;
              error?: string;
              errorStack?: string;
            } = {
              type: 'status_update',
              status: updatedRun.status,
            };
            
            // Include error details if status is FAILED
            if (updatedRun.status === 'FAILED' && updatedRun.metadata) {
              const metadata = updatedRun.metadata as Record<string, unknown>;
              if (metadata.error) {
                statusData.error = String(metadata.error);
              }
              if (metadata.errorStack) {
                statusData.errorStack = String(metadata.errorStack);
              }
            }
            
            safeEnqueue(`data: ${JSON.stringify(statusData)}\n\n`);
            lastStatus = updatedRun.status;

            // Check if complete
            if (
              updatedRun.status === 'COMPLETE' ||
              updatedRun.status === 'FAILED' ||
              updatedRun.status === 'CANCELLED'
            ) {
              isComplete = true;
            }
          }

          // Close stream if complete
          if (isComplete) {
            clearInterval(pollInterval);
            if (!streamClosed) {
              streamClosed = true;
              controller.close();
            }
          }
        } catch (error) {
          consecutiveErrors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          
          console.error(`[SSE] Stream polling error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}) for run ${runId}:`, errorMessage);
          if (errorStack) {
            console.error(`[SSE] Error stack:`, errorStack);
          }
          
          // If we've had too many consecutive errors, close the stream
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`[SSE] Too many consecutive errors (${consecutiveErrors}), closing stream for run ${runId}`);
            clearInterval(pollInterval);
            const errorData = {
              type: 'error',
              error: 'Failed to poll run updates - too many errors',
              details: errorMessage,
            };
            safeEnqueue(`data: ${JSON.stringify(errorData)}\n\n`);
            if (!streamClosed) {
              streamClosed = true;
              controller.close();
            }
            return;
          }
          
          // Send error to client but continue polling (only if stream is still open)
          if (!streamClosed) {
            const errorData = {
              type: 'error',
              error: 'Failed to poll run updates',
              details: errorMessage,
              consecutiveErrors,
            };
            safeEnqueue(`data: ${JSON.stringify(errorData)}\n\n`);
          }
        }
      }, 250); // Poll every 250ms for more responsive updates (especially for execution logs)

      // Cleanup on client disconnect
      return () => {
        console.log(`[SSE] Cleaning up stream for run ${runId}`);
        clearInterval(pollInterval);
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch (err) {
            // Stream may already be closed
            console.error(`[SSE] Error closing stream for run ${runId}:`, err);
          }
        }
      };
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Verify user has access to this run
  const run = await db.agentRun.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  if (run.userId !== user.id && !user.roles.includes('admin')) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 }
    );
  }

  // Create SSE stream
  const stream = createReadableStream(id);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
