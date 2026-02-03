import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/runs/:id/cancel
 * Cancel a running run
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await context.params;
    const body = await validateRequestBody(request, validationSchemas.cancelRun);

    // Load run
    const run = await db.agentRun.findUnique({
      where: { id },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if user owns the run or is admin
    if (run.userId !== user.id && !user.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if run can be cancelled
    if (run.status === 'COMPLETE' || run.status === 'FAILED' || run.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Run cannot be cancelled in current state' },
        { status: 400 }
      );
    }

    // Cancel run
    const updatedRun = await db.agentRun.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: body.reason || 'Cancelled by user',
      },
    });

    // Log audit event
    await audit.agentRunCancelled(run.id, user.id, {
      reason: body.reason,
    }, request);

    return NextResponse.json({ run: updatedRun });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Cancel run error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel run' },
      { status: 500 }
    );
  }
}
