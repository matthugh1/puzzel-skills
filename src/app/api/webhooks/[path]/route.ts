/**
 * POST /api/webhooks/:path
 * Webhook receiver endpoint for triggering workflows
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';
import { verifyWebhookSignature } from '@/lib/runtime/webhook-utils';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ path: string }>;
}

/**
 * Map webhook payload to initialContext
 */
function mapWebhookPayloadToContext(
  payload: unknown,
  mapping?: Record<string, string>
): Record<string, unknown> {
  if (!mapping) {
    // Default: use entire payload as context
    return { payload };
  }

  // Map fields according to mapping config
  const context: Record<string, unknown> = {};
  for (const [contextKey, payloadPath] of Object.entries(mapping)) {
    // Simple JSONPath-like extraction (can be enhanced with jsonpath-plus)
    context[contextKey] = getValueFromPath(payloadPath, payload);
  }

  return context;
}

/**
 * Get value from JSONPath expression (simplified)
 */
function getValueFromPath(path: string, obj: unknown): unknown {
  // Remove $ prefix if present
  const cleanPath = path.replace(/^\$\.?/, '');
  const parts = cleanPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current === 'object' && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path: webhookPath } = await context.params;

  // Find webhook endpoint
  const endpoint = await db.webhookEndpoint.findUnique({
    where: { path: webhookPath },
    include: {
      workflow: true,
    },
  });

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Webhook not found' },
      { status: 404 }
    );
  }

  if (endpoint.workflow.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Workflow not published' },
      { status: 400 }
    );
  }

  // Rate limiting (per webhook path)
  // Use custom identifier for webhook-specific rate limiting
  const rateLimitResponse = rateLimit(request, {
    ...RATE_LIMITS.API,
    identifier: () => `webhook:${webhookPath}`,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Verify signature if secret configured
  if (endpoint.secret) {
    const signature = request.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const body = await request.text();
    if (!verifyWebhookSignature(body, signature, endpoint.secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload after verification
    const payload = JSON.parse(body);

    // Map payload to initialContext
    const initialContext = mapWebhookPayloadToContext(
      payload,
      endpoint.headers as Record<string, string> | undefined
    );

    // Create AgentRun
    const run = await db.agentRun.create({
      data: {
        workflowId: endpoint.workflowId,
        userId: endpoint.workflow.ownerId, // Use workflow owner
        goal: `Webhook triggered: ${webhookPath}`,
        initialContext,
        status: 'RUNNING', // Skip planning for workflows
        plan: endpoint.workflow.plan, // Use workflow's plan
      },
    });

    // Trigger execution (async)
    executeWorkflow(run.id).catch((error) => {
      console.error('Webhook execution error:', error);
    });

    // Update trigger last triggered time (if trigger exists)
    await db.workflowTrigger
      .updateMany({
        where: {
          workflowId: endpoint.workflowId,
          triggerType: 'WEBHOOK',
        },
        data: { lastTriggeredAt: new Date() },
      })
      .catch(console.error);

    return NextResponse.json(
      { runId: run.id, status: 'triggered' },
      { status: 202 }
    );
  } else {
    // No secret - parse payload directly
    const payload = await request.json();

    // Map payload to initialContext
    const initialContext = mapWebhookPayloadToContext(
      payload,
      endpoint.headers as Record<string, string> | undefined
    );

    // Create AgentRun
    const run = await db.agentRun.create({
      data: {
        workflowId: endpoint.workflowId,
        userId: endpoint.workflow.ownerId,
        goal: `Webhook triggered: ${webhookPath}`,
        initialContext,
        status: 'RUNNING',
        plan: endpoint.workflow.plan,
      },
    });

    // Trigger execution (async)
    executeWorkflow(run.id).catch((error) => {
      console.error('Webhook execution error:', error);
    });

    // Update trigger last triggered time
    await db.workflowTrigger
      .updateMany({
        where: {
          workflowId: endpoint.workflowId,
          triggerType: 'WEBHOOK',
        },
        data: { lastTriggeredAt: new Date() },
      })
      .catch(console.error);

    return NextResponse.json(
      { runId: run.id, status: 'triggered' },
      { status: 202 }
    );
  }
}
