/**
 * GET /api/workflows/:id/activity
 * Get workflow activity log
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

    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('eventType')?.trim();
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get audit logs for this workflow
    const where: Record<string, unknown> = {
      resourceType: 'workflow',
      resourceId: id,
    };

    // Filter by event type if specified
    if (eventType) {
      where.action = {
        contains: eventType,
      };
    }

    const auditLogs = await db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 500), // Cap at 500
    });

    // Also get run events
    const runs = await db.agentRun.findMany({
      where: { workflowId: id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        failedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Combine and sort by date
    const activities = [
      ...auditLogs.map((log) => ({
        type: 'audit' as const,
        id: log.id,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
        details: log.details,
      })),
      ...runs.map((run) => ({
        type: 'run' as const,
        id: run.id,
        action: `run.${run.status.toLowerCase()}`,
        createdAt: run.createdAt.toISOString(),
        user: run.user,
        details: {
          status: run.status,
          completedAt: run.completedAt?.toISOString(),
          failedAt: run.failedAt?.toISOString(),
        },
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Get workflow activity error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow activity' },
      { status: 500 }
    );
  }
}
