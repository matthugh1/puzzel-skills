/**
 * GET /api/workspaces/[id]/integrations
 * List user's connected integrations with their available actions for workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createIntegrationAdapter } from '@/lib/integrations/registry';
import { getAvailableIntegrations } from '@/lib/integrations/registry';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKSPACES_READ);
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
    // Verify workspace membership
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: user.id },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const isOwner = workspace.ownerId === user.id;
    const isMember = workspace.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

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
      },
    });

    // Get available integrations metadata
    const availableIntegrations = getAvailableIntegrations();

    // For each connected integration, get its actions
    const integrationsWithActions = await Promise.all(
      connectedIntegrations.map(async (integration) => {
        try {
          const adapter = createIntegrationAdapter(integration.appName as 'gmail' | 'slack' | 'office365');
          const actions = await adapter.getActions();

          const appInfo = availableIntegrations.find(
            (app) => app.name === integration.appName
          );

          return {
            id: integration.id,
            appName: integration.appName,
            displayName: appInfo?.displayName || integration.appName,
            description: appInfo?.description || '',
            status: integration.status,
            lastSyncAt: integration.lastSyncAt,
            actions: actions.map((action) => ({
              name: action.name,
              description: action.description,
              inputSchema: action.inputSchema,
              outputSchema: action.outputSchema,
            })),
          };
        } catch (error) {
          console.error(`Error loading actions for ${integration.appName}:`, error);
          return {
            id: integration.id,
            appName: integration.appName,
            displayName: integration.appName,
            description: '',
            status: integration.status,
            lastSyncAt: integration.lastSyncAt,
            actions: [],
            error: error instanceof Error ? error.message : 'Failed to load actions',
          };
        }
      })
    );

    return NextResponse.json({
      integrations: integrationsWithActions,
    });
  } catch (error) {
    console.error('List workspace integrations error:', error);
    return NextResponse.json(
      { error: 'Failed to list integrations' },
      { status: 500 }
    );
  }
}
