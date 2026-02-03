/**
 * GET /api/integrations
 * List available integrations and user's connected apps
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getAvailableIntegrations } from '@/lib/integrations/registry';

export async function GET(request: NextRequest) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get available integrations
    const availableIntegrations = getAvailableIntegrations();

    // Get user's connected integrations
    const connectedIntegrations = await db.appIntegration.findMany({
      where: {
        userId: user.id,
        status: 'CONNECTED',
      },
      select: {
        id: true,
        appName: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      available: availableIntegrations,
      connected: connectedIntegrations,
    });
  } catch (error) {
    console.error('List integrations error:', error);
    return NextResponse.json(
      { error: 'Failed to list integrations' },
      { status: 500 }
    );
  }
}
