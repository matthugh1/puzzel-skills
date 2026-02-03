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
 * POST /api/workflows/:id/publish
 * Publish a workflow (changes status from DRAFT to PUBLISHED)
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

  // Can only publish DRAFT workflows
  if (workflow.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot publish workflow with status ${workflow.status}. Only DRAFT workflows can be published.` },
      { status: 400 }
    );
  }

  try {
    // Validate workflow plan has at least one step
    const plan = workflow.plan as { steps?: unknown[] };
    if (!plan.steps || plan.steps.length === 0) {
      return NextResponse.json(
        { error: 'Workflow must have at least one step before publishing' },
        { status: 400 }
      );
    }

    // Publish workflow
    const updatedWorkflow = await db.workflow.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workflowPublished(id, user.id, {
      workflowName: workflow.name,
    }, request);

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    console.error('Publish workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to publish workflow' },
      { status: 500 }
    );
  }
}
