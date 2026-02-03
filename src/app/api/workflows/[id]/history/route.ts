/**
 * GET /api/workflows/:id/history
 * Get workflow edit history from audit logs
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

    // Get audit logs for this workflow
    const auditLogs = await db.auditLog.findMany({
      where: {
        resourceType: 'workflow',
        resourceId: id,
        action: {
          in: ['workflow.created', 'workflow.updated', 'workflow.archived', 'workflow.published', 'workflow.shared', 'workflow.unshared'],
        },
      },
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
    });

    return NextResponse.json({ history: auditLogs });
  } catch (error) {
    console.error('Get workflow history error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow history' },
      { status: 500 }
    );
  }
}
