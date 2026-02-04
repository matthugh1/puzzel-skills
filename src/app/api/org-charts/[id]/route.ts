import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/org-charts/:id
 * Get org chart by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_READ);
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
    const chart = await db.orgChart.findUnique({
      where: { id },
    });

    if (!chart) {
      return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
    }

    return NextResponse.json({ chart });
  } catch (error) {
    console.error('Get org chart error:', error);
    return NextResponse.json({ error: 'Failed to load org chart' }, { status: 500 });
  }
}

/**
 * PATCH /api/org-charts/:id
 * Update org chart
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;

  try {
    const body = await validateRequestBody(request, validationSchemas.updateOrgChart);

    const existing = await db.orgChart.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
    }

    const updateData: {
      name?: string;
      visibility?: 'TEAM' | 'ORG';
      isDefault?: boolean;
    } = {};

    if (body.name) updateData.name = body.name;
    if (body.visibility) updateData.visibility = body.visibility;
    if (typeof body.isDefault === 'boolean') updateData.isDefault = body.isDefault;

    const chart = await db.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.orgChart.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.orgChart.update({
        where: { id },
        data: updateData,
      });
    });

    await audit.orgChartUpdated(chart.id, user.id, { name: chart.name }, request);

    return NextResponse.json({ chart });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update org chart error:', error);
    return NextResponse.json({ error: 'Failed to update org chart' }, { status: 500 });
  }
}
