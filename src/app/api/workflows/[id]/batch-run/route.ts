/**
 * POST /api/workflows/:id/batch-run
 * Execute a workflow with multiple initial contexts (batch processing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { executeBatchRun } from '@/lib/runtime/batch-executor';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const batchRunSchema = z.object({
  items: z.array(z.object({
    initialContext: z.record(z.unknown()),
    idempotencyKey: z.string().optional(),
  })).min(1).max(1000), // Max 1000 items per batch
  concurrency: z.number().int().min(1).max(20).optional().default(5),
  policyId: z.string().cuid().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_CREATE);
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
    // Validate request body
    const body = await validateRequestBody(request, batchRunSchema);

    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id },
      include: {
        owner: true,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check if workflow is published
    if (workflow.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Workflow must be published to run' },
        { status: 400 }
      );
    }

    // Check permissions (workflow visibility)
    if (workflow.visibility === 'TEAM' && workflow.ownerId !== user.id) {
      // TODO: Check if user is in same team
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Create batch run record
    const batchRun = await db.batchRun.create({
      data: {
        workflowId: workflow.id,
        userId: user.id,
        totalItems: body.items.length,
        concurrency: body.concurrency || 5,
        status: 'PENDING',
        metadata: {
          policyId: body.policyId,
        },
      },
    });

    // Create individual run records
    const runs = await Promise.all(
      body.items.map((item, index) =>
        db.agentRun.create({
          data: {
            userId: user.id,
            workflowId: workflow.id,
            batchId: batchRun.id,
            batchIndex: index,
            status: 'PLANNING',
            goal: `Batch item ${index + 1}`,
            initialContext: item.initialContext,
            policyId: body.policyId || null,
            idempotencyKey: item.idempotencyKey || null,
          },
        })
      )
    );

    // Start batch execution asynchronously
    executeBatchRun(batchRun.id, runs.map((r) => r.id), body.concurrency || 5).catch(
      (error) => {
        console.error('Batch execution error:', error);
        db.batchRun
          .update({
            where: { id: batchRun.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
            },
          })
          .catch(console.error);
      }
    );

    // Log audit event
    await audit.workflowUpdated(workflow.id, user.id, {
      batchRunCreated: {
        batchId: batchRun.id,
        itemCount: body.items.length,
      },
    }, request);

    return NextResponse.json(
      {
        batch: {
          id: batchRun.id,
          status: batchRun.status,
          totalItems: batchRun.totalItems,
          concurrency: batchRun.concurrency,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('Batch run error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create batch run' },
      { status: 500 }
    );
  }
}
