/**
 * POST /api/tasks/:id/complete
 * Complete a task and resume workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const completeTaskSchema = z.object({
  result: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_CREATE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate request body
    const body = await validateRequestBody(request, completeTaskSchema);

    // Load task
    const task = await db.runTask.findUnique({
      where: { id },
      include: {
        run: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (task.assigneeId !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check status
    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Task already completed or cancelled' },
        { status: 400 }
      );
    }

    // Update task
    await db.runTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        result: body.result || {},
        completedAt: new Date(),
      },
    });

    // Update run status and resume workflow
    await db.agentRun.update({
      where: { id: task.runId },
      data: {
        status: 'RUNNING',
        blockedReason: null,
        metadata: {
          ...((task.run.metadata as Record<string, unknown>) || {}),
          taskCompleted: {
            taskId: task.id,
            stepIndex: task.stepIndex,
            result: body.result || {},
          },
        },
      },
    });

    // Resume workflow execution
    executeWorkflow(task.runId).catch((error) => {
      console.error('Error resuming workflow after task completion:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Complete task error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    );
  }
}
