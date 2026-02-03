/**
 * GET /api/workflows/:id/triggers - List triggers
 * POST /api/workflows/:id/triggers - Create trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { audit } from '@/lib/audit';
import { generateWebhookPath, generateWebhookSecret } from '@/lib/runtime/webhook-utils';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createTriggerSchema = z.object({
  triggerType: z.enum(['MANUAL', 'WEBHOOK', 'SCHEDULED', 'APP_EVENT']),
  config: z.record(z.unknown()),
});

/**
 * GET /api/workflows/:id/triggers
 * List all triggers for a workflow
 */
export async function GET(request: Request, context: RouteContext) {
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
      include: {
        triggers: {
          include: {
            workflow: {
              select: { id: true, name: true },
            },
          },
        },
        webhookEndpoints: true,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check access
    if (workflow.visibility === 'TEAM' && workflow.ownerId !== user.id && !user.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Workflow not accessible' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      triggers: workflow.triggers,
      webhookEndpoints: workflow.webhookEndpoints,
    });
  } catch (error) {
    console.error('List triggers error:', error);
    return NextResponse.json(
      { error: 'Failed to list triggers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/:id/triggers
 * Create a new trigger for a workflow
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_UPDATE);
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

    // Check ownership
    if (!canModifyResource(user, workflow.ownerId)) {
      return NextResponse.json(
        { error: 'Forbidden: you do not own this workflow' },
        { status: 403 }
      );
    }

    // Validate input
    const body = await validateRequestBody(request, createTriggerSchema);
    const { triggerType, config } = body;

    // Create trigger
    let trigger;
    let webhookEndpoint = null;

    if (triggerType === 'WEBHOOK') {
      // Generate webhook path and secret
      const webhookPath = generateWebhookPath();
      const webhookSecret = generateWebhookSecret();

      // Create webhook endpoint
      webhookEndpoint = await db.webhookEndpoint.create({
        data: {
          workflowId: workflow.id,
          path: webhookPath,
          secret: webhookSecret,
          headers: (config.headers as Record<string, unknown>) || null,
        },
      });

      // Create trigger
      trigger = await db.workflowTrigger.create({
        data: {
          workflowId: workflow.id,
          triggerType: 'WEBHOOK',
          config: {
            ...config,
            webhookPath,
          },
          status: 'ACTIVE',
        },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
      });
    } else if (triggerType === 'SCHEDULED') {
      // Validate cron expression
      const cronExpression = (config.cronExpression as string) || '';
      if (!cronExpression) {
        return NextResponse.json(
          { error: 'Scheduled trigger requires cronExpression' },
          { status: 400 }
        );
      }

      // Create trigger
      trigger = await db.workflowTrigger.create({
        data: {
          workflowId: workflow.id,
          triggerType: 'SCHEDULED',
          config,
          status: 'ACTIVE',
        },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
      });
    } else {
      // MANUAL or APP_EVENT
      trigger = await db.workflowTrigger.create({
        data: {
          workflowId: workflow.id,
          triggerType,
          config,
          status: 'ACTIVE',
        },
        include: {
          workflow: {
            select: { id: true, name: true },
          },
        },
      });
    }

    // Log audit event
    await audit.workflowUpdated(workflow.id, user.id, {
      triggerCreated: {
        triggerId: trigger.id,
        triggerType: trigger.triggerType,
      },
    }, request);

    return NextResponse.json(
      {
        trigger,
        webhookEndpoint,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to create trigger' },
      { status: 500 }
    );
  }
}
