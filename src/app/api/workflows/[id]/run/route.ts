import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/workflows/:id/run
 * Execute a workflow (creates AgentRun and triggers execution)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
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
    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check workflow is published
    if (workflow.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Workflow is not published' },
        { status: 400 }
      );
    }

    // Check visibility permissions
    if (workflow.visibility === 'TEAM' && workflow.ownerId !== user.id) {
      // TODO: Check team membership (simplified for MVP)
      return NextResponse.json(
        { error: 'Workflow not accessible' },
        { status: 403 }
      );
    }

    // Validate input
    const body = await validateRequestBody(request, validationSchemas.runWorkflow);
    const { initialContext, policyId, inputAllowlist, idempotencyKey } = body;

    // Load policy if provided
    let policy = null;
    if (policyId) {
      policy = await db.runPolicy.findUnique({
        where: { id: policyId },
      });
      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }
    }

    // Validate initialContext size
    const initialContextSize = JSON.stringify(initialContext).length;
    const maxSize = policy?.maxInitialContextBytes ?? 100000;
    if (initialContextSize > maxSize) {
      return NextResponse.json(
        { error: `Initial context size (${initialContextSize} bytes) exceeds policy limit (${maxSize} bytes)` },
        { status: 400 }
      );
    }

    // Create AgentRun with workflow's plan
    const run = await db.agentRun.create({
      data: {
        workflowId: workflow.id,
        userId: user.id,
        goal: workflow.name, // Use workflow name as goal
        initialContext,
        policyId: policy?.id ?? null,
        inputAllowlist: inputAllowlist || null,
        status: 'RUNNING', // Skip planning - use workflow's plan
        plan: workflow.plan, // Use workflow's predefined plan
        idempotencyKey: idempotencyKey || null,
        startedAt: new Date(),
      },
      include: {
        workflow: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.agentRunCreated(run.id, user.id, {
      goal: run.goal,
      workflowId: workflow.id,
      policyId: run.policyId,
    }, request);

    // Trigger LangGraph execution (async, don't wait)
    executeWorkflow(run.id).catch((error) => {
      console.error('Workflow execution error:', error);
      // Update run status to FAILED
      db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      }).catch(console.error);
    });

    // Return immediately (202 Accepted for async operations)
    return NextResponse.json(
      { run: { id: run.id, status: run.status } },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Run workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to run workflow' },
      { status: 500 }
    );
  }
}
