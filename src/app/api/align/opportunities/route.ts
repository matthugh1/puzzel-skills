import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { logAudit, getIpAddress, getUserAgent } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * POST /api/align/opportunities
 * Create an opportunity
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
    const body = await validateRequestBody(request, validationSchemas.createOpportunity);

    const snapshot = await db.alignmentSnapshot.findUnique({
      where: { id: body.snapshotId },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Alignment snapshot not found' }, { status: 404 });
    }

    const opportunity = await db.opportunity.create({
      data: {
        snapshotId: body.snapshotId,
        title: body.title,
        description: body.description,
        department: body.department,
        valueScore: body.valueScore,
        feasibilityScore: body.feasibilityScore,
        timeToPilotWeeks: body.timeToPilotWeeks,
        status: body.status ?? 'IDEA',
        ownerId: user.id,
      },
    });

    await logAudit({
      action: 'align.opportunity.created',
      resourceType: 'align',
      resourceId: opportunity.id,
      userId: user.id,
      details: { title: opportunity.title, snapshotId: opportunity.snapshotId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create opportunity error:', error);
    return NextResponse.json(
      { error: 'Failed to create opportunity' },
      { status: 500 }
    );
  }
}
