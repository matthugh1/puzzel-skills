import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { canViewWorkflow, canEditWorkflow } from '@/lib/workflow-permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workflows/:id
 * Get workflow details
 */
export async function GET(request: Request, context: RouteContext) {
  const user = await getUserFromRequest(request);
  const { id } = await context.params;

  const workflow = await db.workflow.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { runs: true },
      },
    },
  });

  if (!workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    );
  }

  // Check access using permission checker (handles ownership, sharing, visibility)
  if (user) {
    const canView = await canViewWorkflow(user.id, id);
    if (!canView) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }
  } else if (workflow.status !== 'PUBLISHED' || workflow.visibility !== 'ORG') {
    // Unauthenticated users can only view published ORG workflows
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ workflow });
}

/**
 * PUT /api/workflows/:id
 * Update workflow
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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

  // Check ownership (owner or admin can update)
  if (!canModifyResource(user, workflow.ownerId)) {
    return NextResponse.json(
      { error: 'Forbidden: you do not own this workflow' },
      { status: 403 }
    );
  }

  // Cannot update published workflows (must unpublish first)
  if (workflow.status === 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Cannot update published workflow. Unpublish it first to make changes.' },
      { status: 400 }
    );
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.updateWorkflow);
    const { name, description, category, tags, plan, visibility, folderId, llmProvider, llmModel } = body;

    // Get old values for audit
    const oldValues = {
      name: workflow.name,
      description: workflow.description,
      category: workflow.category,
      tags: workflow.tags,
      visibility: workflow.visibility,
    };

    // If folderId is provided, verify folder exists and belongs to user
    if (folderId !== undefined) {
      if (folderId) {
        const folder = await db.folder.findUnique({
          where: { id: folderId },
        });
        if (!folder) {
          return NextResponse.json(
            { error: 'Folder not found' },
            { status: 404 }
          );
        }
        if (folder.ownerId !== user.id) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          );
        }
      }
    }

    // Update workflow
    const updatedWorkflow = await db.workflow.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(tags && { tags }),
        ...(plan && { plan: plan as Record<string, unknown> }),
        ...(visibility && { visibility }),
        ...(folderId !== undefined && { folderId }),
        ...(llmProvider !== undefined && { llmProvider }),
        ...(llmModel !== undefined && { llmModel }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workflowUpdated(id, user.id, {
      oldValues,
      newValues: {
        name: updatedWorkflow.name,
        description: updatedWorkflow.description,
        category: updatedWorkflow.category,
        tags: updatedWorkflow.tags,
        visibility: updatedWorkflow.visibility,
      },
    }, request);

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/:id
 * Archive workflow (soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_DELETE);
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

  // Check edit permission (owner, editor, or admin can delete)
  const canEdit = await canEditWorkflow(user.id, id);
  if (!canEdit) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions to delete workflow' },
      { status: 403 }
    );
  }

  try {
    // Soft delete by archiving
    await db.workflow.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    // Log audit event
    await audit.workflowArchived(id, user.id, {
      workflowName: workflow.name,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}
