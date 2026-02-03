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
 * PUT /api/align/coalition/[id]
 * Update a coalition member
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
    const body = await validateRequestBody(request, validationSchemas.updateCoalitionMember);

    const existing = await db.coalitionMember.findUnique({
      where: { id },
      include: { snapshot: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Coalition member not found' }, { status: 404 });
    }

    const canEdit =
      user.id === existing.userId ||
      canModifyResource(user, existing.snapshot.ownerId);

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const coalitionMember = await db.coalitionMember.update({
      where: { id },
      data: {
        role: body.role,
        notes: body.notes,
      },
    });

    await logAudit({
      action: 'align.coalition.updated',
      resourceType: 'align',
      resourceId: coalitionMember.id,
      userId: user.id,
      details: { role: coalitionMember.role },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ coalitionMember });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update coalition member error:', error);
    return NextResponse.json(
      { error: 'Failed to update coalition member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/align/coalition/[id]
 * Delete a coalition member
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

  const existing = await db.coalitionMember.findUnique({
    where: { id },
    include: { snapshot: true },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Coalition member not found' }, { status: 404 });
  }

  const canEdit =
    user.id === existing.userId ||
    canModifyResource(user, existing.snapshot.ownerId);

  if (!canEdit) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  await db.coalitionMember.delete({ where: { id } });

  await logAudit({
    action: 'align.coalition.deleted',
    resourceType: 'align',
    resourceId: existing.id,
    userId: user.id,
    details: { role: existing.role },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true });
}
