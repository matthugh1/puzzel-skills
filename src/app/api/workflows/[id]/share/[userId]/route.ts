/**
 * DELETE /api/workflows/:id/share/:userId
 * Unshare workflow with a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { audit } from '@/lib/audit';
import { canEditWorkflow } from '@/lib/workflow-permissions';

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_UPDATE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id, userId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if user can edit workflow
    const canEdit = await canEditWorkflow(user.id, id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to unshare workflow' },
        { status: 403 }
      );
    }

    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Delete share
    const share = await db.workflowShare.findUnique({
      where: {
        workflowId_userId: {
          workflowId: id,
          userId,
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    await db.workflowShare.delete({
      where: {
        workflowId_userId: {
          workflowId: id,
          userId,
        },
      },
    });

    // Log audit event
    await audit.workflowUnshared(workflow.id, user.id, {
      userId,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unshare workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to unshare workflow' },
      { status: 500 }
    );
  }
}
