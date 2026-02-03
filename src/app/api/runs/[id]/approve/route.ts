import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { executeRun } from '@/lib/runtime/execution-engine';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/runs/:id/approve
 * Approve a blocked run
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization - requires runs:approve permission
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.RUNS_APPROVE);
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
    const body = await validateRequestBody(request, validationSchemas.approveRun);

    // Load run with approval
    const run = await db.agentRun.findUnique({
      where: { id },
      include: {
        approvals: {
          where: { approvedAt: null, rejectedAt: null },
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if run is blocked
    if (run.status !== 'BLOCKED') {
      return NextResponse.json(
        { error: 'Run is not blocked and does not require approval' },
        { status: 400 }
      );
    }

    // Check if there's a pending approval
    const pendingApproval = run.approvals[0];
    if (!pendingApproval) {
      return NextResponse.json(
        { error: 'No pending approval found' },
        { status: 400 }
      );
    }

    // Prevent self-approval
    if (pendingApproval.requestedBy === user.id) {
      return NextResponse.json(
        { error: 'Cannot approve own run' },
        { status: 400 }
      );
    }

    // Update approval record
    const updatedApproval = await db.runApproval.update({
      where: { id: pendingApproval.id },
      data: {
        approvedAt: new Date(),
        approvedBy: user.id,
        reason: body.comments || 'Approved',
      },
    });

    // Transition run to RUNNING
    const updatedRun = await db.agentRun.update({
      where: { id },
      data: {
        status: 'RUNNING',
        blockedReason: null,
      },
    });

    // Log audit event
    await audit.agentApprovalApproved(updatedApproval.id, user.id, {
      runId: id,
      comments: body.comments,
    }, request);

    // Trigger execution (async)
    executeRun(id).catch((error) => {
      console.error('Error executing approved run:', error);
    });

    return NextResponse.json({ run: updatedRun, approval: updatedApproval });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Approve run error:', error);
    return NextResponse.json(
      { error: 'Failed to approve run' },
      { status: 500 }
    );
  }
}
