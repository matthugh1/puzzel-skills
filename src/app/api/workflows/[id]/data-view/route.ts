/**
 * GET /api/workflows/:id/data-view
 * Get workflow data view (context variables and step outputs)
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

    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
      select: {
        plan: true,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    const plan = workflow.plan as {
      steps?: Array<{
        id: string;
        type: string;
        config?: Record<string, unknown>;
      }>;
    };

    // Extract context variables from workflow plan
    const contextVariables = new Set<string>();
    const stepOutputs: Array<{
      stepId: string;
      stepType: string;
      outputs: string[];
    }> = [];

    if (plan.steps) {
      plan.steps.forEach((step) => {
        // Extract variables from step configs (e.g., input variables, conditions)
        if (step.config) {
          const configStr = JSON.stringify(step.config);
          // Simple regex to find variable references like ${var} or {{var}}
          const varMatches = configStr.matchAll(/\$\{([^}]+)\}|\{\{([^}]+)\}\}/g);
          for (const match of varMatches) {
            const varName = match[1] || match[2];
            if (varName) {
              contextVariables.add(varName.trim());
            }
          }
        }

        // For skill steps, add common output variables
        if (step.type === 'SKILL' && step.id) {
          stepOutputs.push({
            stepId: step.id,
            stepType: step.type,
            outputs: [`${step.id}.result`, `${step.id}.output`],
          });
        }
      });
    }

    // Get recent run data to show actual data flow
    const recentRuns = await db.agentRun.findMany({
      where: { workflowId: id },
      select: {
        id: true,
        status: true,
        initialContext: true,
        steps: {
          select: {
            stepIndex: true,
            output: true,
            errorMessage: true,
          },
          orderBy: {
            stepIndex: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    return NextResponse.json({
      contextVariables: Array.from(contextVariables),
      stepOutputs,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        status: run.status,
        initialContext: run.initialContext,
        steps: run.steps.map((step) => ({
          stepIndex: step.stepIndex,
          output: step.output,
          errorMessage: step.errorMessage,
        })),
      })),
    });
  } catch (error) {
    console.error('Get workflow data view error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow data view' },
      { status: 500 }
    );
  }
}
