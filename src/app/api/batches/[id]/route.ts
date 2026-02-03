/**
 * GET /api/batches/:id
 * Get batch run details
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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
    const batch = await db.batchRun.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        runs: {
          orderBy: {
            batchIndex: 'asc',
          },
          select: {
            id: true,
            batchIndex: true,
            status: true,
            goal: true,
            initialContext: true,
            startedAt: true,
            completedAt: true,
            failedAt: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (batch.userId !== user.id) {
      // TODO: Check workflow visibility and team membership
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({ batch });
  } catch (error) {
    console.error('Get batch error:', error);
    return NextResponse.json(
      { error: 'Failed to get batch' },
      { status: 500 }
    );
  }
}
