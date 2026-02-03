/**
 * POST /api/webhooks/wait/:waitId
 * Resume a workflow that was waiting for a webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

interface RouteContext {
  params: Promise<{ waitId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { waitId } = await context.params;

  try {
    // Find run by wait ID (stored in metadata)
    const runs = await db.agentRun.findMany({
      where: {
        status: 'BLOCKED',
        metadata: {
          path: ['waitInfo', 'webhookPath'],
          equals: waitId,
        },
      },
    });

    if (runs.length === 0) {
      return NextResponse.json(
        { error: 'Wait not found or not waiting' },
        { status: 404 }
      );
    }

    const run = runs[0];

    // Parse webhook payload
    const payload = await request.json();

    // Update run metadata with webhook data
    const metadata = (run.metadata as Record<string, unknown>) || {};
    const waitInfo = (metadata.waitInfo as Record<string, unknown>) || {};

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING',
        blockedReason: null,
        metadata: {
          ...metadata,
          waitInfo: {
            ...waitInfo,
            webhookReceived: true,
            webhookPayload: payload,
            resumedAt: new Date().toISOString(),
          },
        },
      },
    });

    // Resume workflow execution
    executeWorkflow(run.id).catch((error) => {
      console.error(`Webhook wait resume execution error for ${run.id}:`, error);
      db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      }).catch(console.error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook wait resume error:', error);
    return NextResponse.json(
      { error: 'Failed to resume workflow' },
      { status: 500 }
    );
  }
}
