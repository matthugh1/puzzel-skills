import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * GET /api/org-charts
 * List org charts
 */
export async function GET(request: NextRequest) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const charts = await db.orgChart.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ charts });
  } catch (error) {
    console.error('List org charts error:', error);
    return NextResponse.json({ error: 'Failed to load org charts' }, { status: 500 });
  }
}

/**
 * POST /api/org-charts
 * Create an org chart
 */
export async function POST(request: NextRequest) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_WRITE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await validateRequestBody(request, validationSchemas.createOrgChart);

    const existingDefault = await db.orgChart.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });

    const shouldSetDefault = body.isDefault ?? !existingDefault;

    const chart = await db.$transaction(async (tx) => {
      if (shouldSetDefault) {
        await tx.orgChart.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.orgChart.create({
        data: {
          name: body.name,
          visibility: body.visibility ?? 'ORG',
          isDefault: shouldSetDefault,
          ownerId: user.id,
        },
      });
    });

    await audit.orgChartCreated(chart.id, user.id, { name: chart.name }, request);

    return NextResponse.json({ chart }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create org chart error:', error);
    return NextResponse.json({ error: 'Failed to create org chart' }, { status: 500 });
  }
}
