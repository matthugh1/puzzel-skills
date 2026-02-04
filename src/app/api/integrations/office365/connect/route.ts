/**
 * POST /api/integrations/office365/connect
 * Initiate Office 365 OAuth flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
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

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const clientId = process.env.OFFICE365_CLIENT_ID;
    const clientSecret = process.env.OFFICE365_CLIENT_SECRET;
    // Use 'common' endpoint to support both business and personal Office 365 accounts
    // All Office 365 business accounts have Azure AD (Microsoft Entra ID) built-in
    const tenantId = process.env.OFFICE365_TENANT_ID || 'common';
    const redirectUri =
      process.env.OFFICE365_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/office365/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { 
          error: 'Office 365 OAuth not configured',
          message: 'Please configure OFFICE365_CLIENT_ID and OFFICE365_CLIENT_SECRET in your environment variables. Register an app at https://portal.azure.com with your Office 365 account.'
        },
        { status: 500 }
      );
    }

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Microsoft Graph API scopes
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
    ];

    // Build OAuth URL
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes.join(' '),
      state: JSON.stringify({ userId: user.id, stateToken: state }),
      prompt: 'consent', // Force consent screen to get refresh token
    }).toString()}`;

    // Store OAuth state in database
    await db.appIntegration.upsert({
      where: {
        userId_appName: {
          userId: user.id,
          appName: 'office365',
        },
      },
      create: {
        userId: user.id,
        appName: 'office365',
        status: 'CONNECTING',
        credentials: {
          oauthState: state,
        },
      },
      update: {
        status: 'CONNECTING',
        credentials: {
          oauthState: state,
        },
      },
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Office 365 OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Office 365 OAuth' },
      { status: 500 }
    );
  }
}
