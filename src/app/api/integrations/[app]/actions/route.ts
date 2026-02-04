/**
 * GET /api/integrations/:app/actions
 * List available actions for an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createIntegrationAdapter } from '@/lib/integrations/registry';

interface RouteContext {
  params: Promise<{ app: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { app } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Create adapter and get actions
    const adapter = createIntegrationAdapter(app as 'gmail' | 'slack' | 'office365');
    const actions = await adapter.getActions();

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('List integration actions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list actions' },
      { status: 500 }
    );
  }
}
