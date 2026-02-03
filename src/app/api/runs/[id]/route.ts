import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/runs/:id
 * Get run details with steps and plan
 */
export async function GET(request: Request, context: RouteContext) {
  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
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
    const { id } = await context.params;

    // Load run with relations
    const run = await db.agentRun.findUnique({
      where: { id },
      include: {
        policy: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        steps: {
          orderBy: { stepIndex: 'asc' },
          include: {
            skillVersion: {
              include: {
                skill: {
                  select: { id: true, name: true },
                },
                metadata: true, // Include full metadata object with executorConfig
              },
            },
          },
        },
        approvals: {
          orderBy: { requestedAt: 'desc' },
          include: {
            requestedByUser: {
              select: { id: true, name: true, email: true },
            },
            approvedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if user owns the run or is admin
    if (run.userId !== user.id && !user.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error('[API Runs] Get run error:', error);
    console.error('[API Runs] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Failed to get run',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
