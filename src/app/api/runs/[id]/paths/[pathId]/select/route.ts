/**
 * POST /api/runs/:id/paths/:pathId/select
 * Select a branch path and resume workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

interface RouteContext {
  params: Promise<{ id: string; pathId: string }>;
}

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
  const { id, pathId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Load run
    const run = await db.agentRun.findUnique({
      where: { id },
      include: {
        pathSelections: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (run.userId !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Find pending path selection
    const pathSelection = run.pathSelections.find((p) => p.id === pathId);

    if (!pathSelection) {
      return NextResponse.json(
        { error: 'Path selection not found or not pending' },
        { status: 404 }
      );
    }

    // Validate selected path is in options
    const pathOptions = pathSelection.pathOptions as Array<{ id: string; label: string }>;
    const selectedOption = pathOptions.find((opt) => opt.id === pathId);

    if (!selectedOption) {
      return NextResponse.json(
        { error: 'Invalid path selection' },
        { status: 400 }
      );
    }

    // Update path selection
    await db.runPath.update({
      where: { id: pathSelection.id },
      data: {
        status: 'SELECTED',
        selectedPath: pathId,
        selectedBy: user.id,
        selectedAt: new Date(),
      },
    });

    // Update run status and resume workflow
    await db.agentRun.update({
      where: { id },
      data: {
        status: 'RUNNING',
        blockedReason: null,
        metadata: {
          ...((run.metadata as Record<string, unknown>) || {}),
          pathSelected: {
            pathSelectionId: pathSelection.id,
            stepIndex: pathSelection.stepIndex,
            selectedPath: pathId,
          },
        },
      },
    });

    // Resume workflow execution
    executeWorkflow(id).catch((error) => {
      console.error('Error resuming workflow after path selection:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Select path error:', error);
    return NextResponse.json(
      { error: 'Failed to select path' },
      { status: 500 }
    );
  }
}
