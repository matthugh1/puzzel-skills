/**
 * POST /api/workflows/:id/share
 * Share workflow with a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { canEditWorkflow } from '@/lib/workflow-permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const shareWorkflowSchema = z.object({
  userId: z.string().cuid(),
  permission: z.enum(['VIEWER', 'EDITOR']),
});

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
    // Validate request body
    const body = await validateRequestBody(request, shareWorkflowSchema);

    // Check if user can edit workflow
    const canEdit = await canEditWorkflow(user.id, id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions to share workflow' },
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

    // Check if user exists
    const sharee = await db.user.findUnique({
      where: { id: body.userId },
    });

    if (!sharee) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create or update share
    const share = await db.workflowShare.upsert({
      where: {
        workflowId_userId: {
          workflowId: id,
          userId: body.userId,
        },
      },
      create: {
        workflowId: id,
        userId: body.userId,
        permission: body.permission,
        sharedBy: user.id,
      },
      update: {
        permission: body.permission,
        sharedBy: user.id,
      },
    });

    // Log audit event
    await audit.workflowShared(workflow.id, user.id, {
      shareId: share.id,
      userId: body.userId,
      permission: body.permission,
    }, request);

    return NextResponse.json({ share });
  } catch (error) {
    console.error('Share workflow error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to share workflow' },
      { status: 500 }
    );
  }
}
