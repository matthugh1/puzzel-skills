/**
 * GET /api/tasks
 * List user's tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const tasks = await db.runTask.findMany({
      where: {
        assigneeId: user.id,
        ...(status && { status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'TIMEOUT' }),
      },
      include: {
        run: {
          select: {
            id: true,
            goal: true,
            status: true,
            workflow: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('List tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to list tasks' },
      { status: 500 }
    );
  }
}
