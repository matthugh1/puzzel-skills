import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { logAudit, getIpAddress, getUserAgent } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * POST /api/align/guardrails
 * Create a guardrail policy
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
    const body = await validateRequestBody(request, validationSchemas.createGuardrailPolicy);

    const snapshot = await db.alignmentSnapshot.findUnique({
      where: { id: body.snapshotId },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Alignment snapshot not found' }, { status: 404 });
    }

    const guardrailPolicy = await db.guardrailPolicy.create({
      data: {
        snapshotId: body.snapshotId,
        createdById: user.id,
        allowedCategories: body.allowedCategories,
        blockedCategories: body.blockedCategories,
        requiresApproval: body.requiresApproval ?? false,
        notes: body.notes,
      },
    });

    await logAudit({
      action: 'align.guardrail.created',
      resourceType: 'align',
      resourceId: guardrailPolicy.id,
      userId: user.id,
      details: { snapshotId: guardrailPolicy.snapshotId },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ guardrailPolicy }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create guardrail policy error:', error);
    return NextResponse.json(
      { error: 'Failed to create guardrail policy' },
      { status: 500 }
    );
  }
}
