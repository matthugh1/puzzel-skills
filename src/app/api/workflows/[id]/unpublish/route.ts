import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/workflows/:id/unpublish
 * Unpublish a workflow (changes status from PUBLISHED to DRAFT)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_UPDATE);
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

  const workflow = await db.workflow.findUnique({
    where: { id },
  });

  if (!workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    );
  }

  // Check ownership
  if (!canModifyResource(user, workflow.ownerId)) {
    return NextResponse.json(
      { error: 'Forbidden: you do not own this workflow' },
      { status: 403 }
    );
  }

  // Can only unpublish PUBLISHED workflows
  if (workflow.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: `Cannot unpublish workflow with status ${workflow.status}. Only PUBLISHED workflows can be unpublished.` },
      { status: 400 }
    );
  }

  try {
    // Unpublish workflow (change status back to DRAFT)
    const updatedWorkflow = await db.workflow.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workflowUpdated(id, user.id, {
      workflowUnpublished: {
        workflowName: workflow.name,
      },
    }, request);

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    console.error('Unpublish workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to unpublish workflow' },
      { status: 500 }
    );
  }
}
