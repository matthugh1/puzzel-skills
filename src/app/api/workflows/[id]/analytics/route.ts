/**
 * GET /api/workflows/:id/analytics
 * Get workflow analytics data
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

    // Get all runs for this workflow
    const runs = await db.agentRun.findMany({
      where: { workflowId: id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        failedAt: true,
        errorMessage: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate metrics
    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status === 'COMPLETED').length;
    const failedRuns = runs.filter((r) => r.status === 'FAILED').length;
    const successRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;
    const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

    // Calculate average duration (for completed runs)
    const completedRunsWithDuration = runs.filter(
      (r) => r.status === 'COMPLETED' && r.completedAt && r.createdAt
    );
    const avgDuration =
      completedRunsWithDuration.length > 0
        ? completedRunsWithDuration.reduce((sum, r) => {
            const duration =
              new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime();
            return sum + duration;
          }, 0) / completedRunsWithDuration.length
        : 0;

    // Time series data (runs per day for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRuns = runs.filter((r) => new Date(r.createdAt) >= thirtyDaysAgo);

    const runsByDay: Record<string, { total: number; completed: number; failed: number }> = {};
    recentRuns.forEach((run) => {
      const day = new Date(run.createdAt).toISOString().split('T')[0];
      if (!runsByDay[day]) {
        runsByDay[day] = { total: 0, completed: 0, failed: 0 };
      }
      runsByDay[day].total++;
      if (run.status === 'COMPLETED') {
        runsByDay[day].completed++;
      } else if (run.status === 'FAILED') {
        runsByDay[day].failed++;
      }
    });

    // Convert to array format
    const timeSeries = Object.entries(runsByDay)
      .map(([date, counts]) => ({
        date,
        total: counts.total,
        completed: counts.completed,
        failed: counts.failed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      metrics: {
        totalRuns,
        completedRuns,
        failedRuns,
        successRate: Math.round(successRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        avgDurationMs: Math.round(avgDuration),
        avgDurationSeconds: Math.round(avgDuration / 1000),
      },
      timeSeries,
    });
  } catch (error) {
    console.error('Get workflow analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow analytics' },
      { status: 500 }
    );
  }
}
