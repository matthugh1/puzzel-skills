import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { logAudit, getIpAddress, getUserAgent } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * GET /api/align
 * List alignment snapshots
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ALIGN_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const snapshots = await db.alignmentSnapshot.findMany({
    where: includeArchived ? {} : { status: { not: 'ARCHIVED' } },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          opportunities: true,
          roadmapItems: true,
          coalitionMembers: true,
          guardrailPolicies: true,
        },
      },
    },
  });

  return NextResponse.json({ snapshots });
}

/**
 * POST /api/align
 * Create a new alignment snapshot
 */
export async function POST(request: NextRequest) {
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

  try {
    const body = await validateRequestBody(request, validationSchemas.createAlignmentSnapshot);
    const status = body.status ?? 'ACTIVE';

    const snapshot = await db.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        await tx.alignmentSnapshot.updateMany({
          where: { status: 'ACTIVE' },
          data: { status: 'ARCHIVED' },
        });
      }

      return tx.alignmentSnapshot.create({
        data: {
          title: body.title,
          summary: body.summary,
          status,
          ownerId: user.id,
        },
      });
    });

    await logAudit({
      action: 'align.snapshot.created',
      resourceType: 'align',
      resourceId: snapshot.id,
      userId: user.id,
      details: { title: snapshot.title, status: snapshot.status },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create alignment snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to create alignment snapshot' },
      { status: 500 }
    );
  }
}
