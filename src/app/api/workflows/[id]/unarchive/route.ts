/**
 * POST /api/workflows/:id/unarchive - Unarchive workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { audit } from '@/lib/audit';
import { canEditWorkflow } from '@/lib/workflow-permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check edit permission
    const canEdit = await canEditWorkflow(user.id, id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
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

    // Unarchive workflow (clear archivedAt)
    const updatedWorkflow = await db.workflow.update({
      where: { id },
      data: {
        archivedAt: null,
      },
    });

    // Log audit event
    await audit.workflowUpdated(workflow.id, user.id, {
      workflowUnarchived: {
        workflowName: workflow.name,
      },
    }, request);

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    console.error('Unarchive workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to unarchive workflow' },
      { status: 500 }
    );
  }
}
