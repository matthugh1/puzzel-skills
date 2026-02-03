/**
 * GET /api/workflows/:id/shared-with
 * List users a workflow is shared with
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { canViewWorkflow } from '@/lib/workflow-permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if user can view workflow
    const canView = await canViewWorkflow(user.id, id);
    if (!canView) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const shares = await db.workflowShare.findMany({
      where: { workflowId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        sharedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        sharedAt: 'desc',
      },
    });

    return NextResponse.json({ shares });
  } catch (error) {
    console.error('List shared users error:', error);
    return NextResponse.json(
      { error: 'Failed to list shared users' },
      { status: 500 }
    );
  }
}
