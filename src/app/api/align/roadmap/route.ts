import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { logAudit, getIpAddress, getUserAgent } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * POST /api/align/roadmap
 * Create a roadmap item
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
    const body = await validateRequestBody(request, validationSchemas.createRoadmapItem);

    const snapshot = await db.alignmentSnapshot.findUnique({
      where: { id: body.snapshotId },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Alignment snapshot not found' }, { status: 404 });
    }

    const roadmapItem = await db.roadmapItem.create({
      data: {
        snapshotId: body.snapshotId,
        opportunityId: body.opportunityId,
        title: body.title,
        priority: body.priority,
        targetQuarter: body.targetQuarter,
        status: body.status ?? 'PLANNED',
        ownerId: user.id,
      },
    });

    await logAudit({
      action: 'align.roadmap.created',
      resourceType: 'align',
      resourceId: roadmapItem.id,
      userId: user.id,
      details: { title: roadmapItem.title, snapshotId: roadmapItem.snapshotId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ roadmapItem }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create roadmap item error:', error);
    return NextResponse.json(
      { error: 'Failed to create roadmap item' },
      { status: 500 }
    );
  }
}
