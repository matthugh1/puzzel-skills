/**
 * GET /api/integrations/office365/callback
 * Office 365 OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { audit } from '@/lib/audit';

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  tenant_id?: string; // Tenant ID from token (personal accounts: 9188040d-6c67-4c5b-b112-36a304b66dad)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=invalid_request`
    );
  }

  try {
    const stateData = JSON.parse(state);
    const { userId, stateToken } = stateData;

    // Verify state token
    const integration = await db.appIntegration.findUnique({
      where: {
        userId_appName: {
          userId,
          appName: 'office365',
        },
      },
    });

    if (!integration) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=integration_not_found`
      );
    }

    const storedState = (integration.credentials as { oauthState?: string })?.oauthState;
    if (storedState !== stateToken) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=invalid_state`
      );
    }

    const clientId = process.env.OFFICE365_CLIENT_ID;
    const clientSecret = process.env.OFFICE365_CLIENT_SECRET;
    const tenantId = process.env.OFFICE365_TENANT_ID || 'common';
    const redirectUri =
      process.env.OFFICE365_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/office365/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_not_configured`
      );
    }

    // Exchange code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const scopes = [
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Tasks.ReadWrite',
      'https://graph.microsoft.com/User.Read',
      // Teams scopes
      'https://graph.microsoft.com/Chat.ReadWrite',
      'https://graph.microsoft.com/ChannelMessage.Read.All',
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Team.ReadBasic.All',
      'offline_access',
    ];
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: scopes.join(' '),
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({})) as { error?: string; error_description?: string };
      console.error('Office 365 token exchange error:', errorData);
      
      // Provide more specific error messages
      let errorMessage = 'token_exchange_failed';
      if (errorData.error === 'invalid_client') {
        errorMessage = 'invalid_client_credentials';
      } else if (errorData.error === 'invalid_grant') {
        errorMessage = 'invalid_authorization_code';
      } else if (errorData.error_description?.includes('tenant')) {
        errorMessage = 'tenant_configuration_error';
      }
      
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=${errorMessage}`
      );
    }

    const tokenData = await tokenResponse.json() as MicrosoftTokenResponse;

    // Encrypt credentials before storing
    // Store the tenant endpoint used for auth (tenantId from env, defaults to 'common')
    // This supports both personal Microsoft accounts and organizational accounts
    // Note: tokenData.tenant_id contains the actual tenant GUID (personal: 9188040d-6c67-4c5b-b112-36a304b66dad)
    // but we use the endpoint tenantId for token refresh operations
    const credentialsToStore = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiryDate: Date.now() + (tokenData.expires_in * 1000),
      tenantId, // Use the endpoint tenantId ('common' by default) for refresh operations
      actualTenantId: tokenData.tenant_id, // Store actual tenant ID for reference
    };

    const encryptedCredentials = encrypt(JSON.stringify(credentialsToStore));

    // Store credentials
    await db.appIntegration.update({
      where: {
        userId_appName: {
          userId,
          appName: 'office365',
        },
      },
      data: {
        status: 'CONNECTED',
        credentials: {
          encrypted: encryptedCredentials,
        },
        lastSyncAt: new Date(),
        errorMessage: null,
      },
    });

    // Log audit event
    await audit.workflowUpdated(integration.id, userId, {
      integrationConnected: {
        appName: 'office365',
      },
    }, request);

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?success=office365_connected`
    );
  } catch (error) {
    console.error('Office 365 OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_failed`
    );
  }
}
