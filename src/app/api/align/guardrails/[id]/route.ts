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
 * PUT /api/align/guardrails/[id]
 * Update a guardrail policy
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
    const body = await validateRequestBody(request, validationSchemas.updateGuardrailPolicy);

    const existing = await db.guardrailPolicy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Guardrail policy not found' }, { status: 404 });
    }

    if (!canModifyResource(user, existing.createdById)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const guardrailPolicy = await db.guardrailPolicy.update({
      where: { id },
      data: {
        allowedCategories: body.allowedCategories,
        blockedCategories: body.blockedCategories,
        requiresApproval: body.requiresApproval,
        notes: body.notes,
      },
    });

    await logAudit({
      action: 'align.guardrail.updated',
      resourceType: 'align',
      resourceId: guardrailPolicy.id,
      userId: user.id,
      details: { snapshotId: guardrailPolicy.snapshotId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ guardrailPolicy });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update guardrail policy error:', error);
    return NextResponse.json(
      { error: 'Failed to update guardrail policy' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/align/guardrails/[id]
 * Delete a guardrail policy
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

  const existing = await db.guardrailPolicy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Guardrail policy not found' }, { status: 404 });
  }

  if (!canModifyResource(user, existing.createdById)) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  await db.guardrailPolicy.delete({ where: { id } });

  await logAudit({
    action: 'align.guardrail.deleted',
    resourceType: 'align',
    resourceId: existing.id,
    userId: user.id,
    details: { snapshotId: existing.snapshotId },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true });
}
