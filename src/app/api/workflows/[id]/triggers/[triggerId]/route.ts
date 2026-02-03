/**
 * PUT /api/workflows/:id/triggers/:triggerId - Update trigger
 * DELETE /api/workflows/:id/triggers/:triggerId - Delete trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { audit } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string; triggerId: string }>;
}

/**
 * PUT /api/workflows/:id/triggers/:triggerId
 * Update trigger
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
  const { id, triggerId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Load workflow and trigger
    const workflow = await db.workflow.findUnique({
      where: { id },
    });

    const trigger = await db.workflowTrigger.findUnique({
      where: { id: triggerId },
    });

    if (!workflow || !trigger || trigger.workflowId !== workflow.id) {
      return NextResponse.json(
        { error: 'Workflow or trigger not found' },
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

    // Parse update data
    const body = await request.json();
    const { config, status } = body;

    // Update trigger
    const updatedTrigger = await db.workflowTrigger.update({
      where: { id: triggerId },
      data: {
        ...(config && { config }),
        ...(status && { status }),
      },
      include: {
        workflow: {
          select: { id: true, name: true },
        },
      },
    });

    // Log audit event
    await audit.workflowUpdated(workflow.id, user.id, {
      triggerUpdated: {
        triggerId: trigger.id,
        changes: { config, status },
      },
    }, request);

    return NextResponse.json({ trigger: updatedTrigger });
  } catch (error) {
    console.error('Update trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to update trigger' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/:id/triggers/:triggerId
 * Delete trigger
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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
  const { id, triggerId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Load workflow and trigger
    const workflow = await db.workflow.findUnique({
      where: { id },
    });

    const trigger = await db.workflowTrigger.findUnique({
      where: { id: triggerId },
      include: {
        workflow: true,
      },
    });

    if (!workflow || !trigger || trigger.workflowId !== workflow.id) {
      return NextResponse.json(
        { error: 'Workflow or trigger not found' },
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

    // Delete webhook endpoint if it exists
    if (trigger.triggerType === 'WEBHOOK') {
      await db.webhookEndpoint.deleteMany({
        where: { workflowId: workflow.id },
      });
    }

    // Delete trigger
    await db.workflowTrigger.delete({
      where: { id: triggerId },
    });

    // Log audit event
    await audit.workflowUpdated(workflow.id, user.id, {
      triggerDeleted: {
        triggerId: trigger.id,
        triggerType: trigger.triggerType,
      },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to delete trigger' },
      { status: 500 }
    );
  }
}
