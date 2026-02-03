/**
 * GET /api/data-inputs
 * List user's data input requests
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

    const dataInputs = await db.dataInputRequest.findMany({
      where: {
        assigneeId: user.id,
        ...(status && { status: status as 'PENDING' | 'SUBMITTED' | 'CANCELLED' | 'TIMEOUT' }),
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

    return NextResponse.json({ dataInputs });
  } catch (error) {
    console.error('List data inputs error:', error);
    return NextResponse.json(
      { error: 'Failed to list data inputs' },
      { status: 500 }
    );
  }
}
