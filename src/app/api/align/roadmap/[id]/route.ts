import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { logAudit, getIpAddress, getUserAgent } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/align/roadmap/[id]
 * Update a roadmap item
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ALIGN_WRITE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  try {
    const body = await validateRequestBody(request, validationSchemas.updateRoadmapItem);

    const existing = await db.roadmapItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Roadmap item not found' }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerId)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const roadmapItem = await db.roadmapItem.update({
      where: { id },
      data: {
        opportunityId:
          body.opportunityId === null ? null : body.opportunityId,
        title: body.title,
        priority: body.priority,
        targetQuarter: body.targetQuarter,
        status: body.status,
      },
    });

    await logAudit({
      action: 'align.roadmap.updated',
      resourceType: 'align',
      resourceId: roadmapItem.id,
      userId: user.id,
      details: { title: roadmapItem.title },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ roadmapItem });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update roadmap item error:', error);
    return NextResponse.json(
      { error: 'Failed to update roadmap item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/align/roadmap/[id]
 * Delete a roadmap item
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ALIGN_WRITE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  const existing = await db.roadmapItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Roadmap item not found' }, { status: 404 });
  }

  if (!canModifyResource(user, existing.ownerId)) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  await db.roadmapItem.delete({ where: { id } });

  await logAudit({
    action: 'align.roadmap.deleted',
    resourceType: 'align',
    resourceId: existing.id,
    userId: user.id,
    details: { title: existing.title },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true });
}
