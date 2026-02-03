/**
 * POST /api/data-inputs/:id/submit
 * Submit data input and resume workflow
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

const submitDataInputSchema = z.object({
  data: z.record(z.unknown()),
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
    const body = await validateRequestBody(request, submitDataInputSchema);

    // Load data input request
    const dataInput = await db.dataInputRequest.findUnique({
      where: { id },
      include: {
        run: true,
      },
    });

    if (!dataInput) {
      return NextResponse.json(
        { error: 'Data input request not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (dataInput.assigneeId !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check status
    if (dataInput.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Data input already submitted or cancelled' },
        { status: 400 }
      );
    }

    // TODO: Validate submitted data against inputSchema

    // Update data input request
    await db.dataInputRequest.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedData: body.data,
        submittedAt: new Date(),
      },
    });

    // Update run status and resume workflow
    await db.agentRun.update({
      where: { id: dataInput.runId },
      data: {
        status: 'RUNNING',
        blockedReason: null,
        metadata: {
          ...((dataInput.run.metadata as Record<string, unknown>) || {}),
          dataInputSubmitted: {
            dataInputId: dataInput.id,
            stepIndex: dataInput.stepIndex,
            data: body.data,
          },
        },
      },
    });

    // Resume workflow execution
    executeWorkflow(dataInput.runId).catch((error) => {
      console.error('Error resuming workflow after data input submission:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit data input error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to submit data input' },
      { status: 500 }
    );
  }
}
