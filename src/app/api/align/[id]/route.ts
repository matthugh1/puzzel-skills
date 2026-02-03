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
 * GET /api/align/[id]
 * Get alignment snapshot details
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ALIGN_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  const snapshot = await db.alignmentSnapshot.findUnique({
    where: { id },
    include: {
      opportunities: { orderBy: { updatedAt: 'desc' } },
      roadmapItems: { orderBy: { priority: 'asc' } },
      coalitionMembers: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      guardrailPolicies: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: 'Alignment snapshot not found' }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}

/**
 * PUT /api/align/[id]
 * Update alignment snapshot
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
    const body = await validateRequestBody(request, validationSchemas.updateAlignmentSnapshot);

    const existing = await db.alignmentSnapshot.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Alignment snapshot not found' }, { status: 404 });
    }

    if (!canModifyResource(user, existing.ownerId)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const updated = await db.$transaction(async (tx) => {
      if (body.status === 'ACTIVE') {
        await tx.alignmentSnapshot.updateMany({
          where: { status: 'ACTIVE', id: { not: id } },
          data: { status: 'ARCHIVED' },
        });
      }

      return tx.alignmentSnapshot.update({
        where: { id },
        data: {
          title: body.title,
          summary: body.summary,
          status: body.status,
        },
      });
    });

    await logAudit({
      action: 'align.snapshot.updated',
      resourceType: 'align',
      resourceId: updated.id,
      userId: user.id,
      details: { title: updated.title, status: updated.status },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ snapshot: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update alignment snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to update alignment snapshot' },
      { status: 500 }
    );
  }
}
