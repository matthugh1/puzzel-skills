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
 * PUT /api/align/opportunities/[id]
 * Update an opportunity
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
    const body = await validateRequestBody(request, validationSchemas.updateOpportunity);

    const existing = await db.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerId)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const opportunity = await db.opportunity.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        department: body.department,
        valueScore: body.valueScore,
        feasibilityScore: body.feasibilityScore,
        timeToPilotWeeks: body.timeToPilotWeeks,
        status: body.status,
      },
    });

    await logAudit({
      action: 'align.opportunity.updated',
      resourceType: 'align',
      resourceId: opportunity.id,
      userId: user.id,
      details: { title: opportunity.title },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ opportunity });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update opportunity error:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/align/opportunities/[id]
 * Delete an opportunity
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

  const existing = await db.opportunity.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  if (!canModifyResource(user, existing.ownerId)) {
    return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
  }

  await db.opportunity.delete({ where: { id } });

  await logAudit({
    action: 'align.opportunity.deleted',
    resourceType: 'align',
    resourceId: existing.id,
    userId: user.id,
    details: { title: existing.title },
    ipAddress: getIpAddress(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true });
}
