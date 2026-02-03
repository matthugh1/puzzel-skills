/**
 * DELETE /api/integrations/:app
 * Disconnect an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { audit } from '@/lib/audit';
import { createIntegrationAdapter } from '@/lib/integrations/registry';
import { decrypt } from '@/lib/encryption';

interface RouteContext {
  params: Promise<{ app: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
  const { app } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Load integration
    const integration = await db.appIntegration.findUnique({
      where: {
        userId_appName: {
          userId: user.id,
          appName: app,
        },
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    // Disconnect via adapter if connected
    if (integration.status === 'CONNECTED') {
      try {
        const adapter = createIntegrationAdapter(app as 'gmail' | 'slack');
        const credentialsData = (integration.credentials as { encrypted?: string })?.encrypted;
        if (credentialsData) {
          const decrypted = decrypt(credentialsData);
          const credentials = JSON.parse(decrypted);
          await adapter.connect(credentials);
          await adapter.disconnect();
        }
      } catch (error) {
        console.error(`Error disconnecting ${app} adapter:`, error);
        // Continue with database update even if adapter disconnect fails
      }
    }

    // Update integration status
    await db.appIntegration.update({
      where: {
        userId_appName: {
          userId: user.id,
          appName: app,
        },
      },
      data: {
        status: 'DISCONNECTED',
        credentials: {},
      },
    });

    // Log audit event
    await audit.workflowUpdated(integration.id, user.id, {
      integrationDisconnected: {
        appName: app,
      },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Disconnect integration error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}
