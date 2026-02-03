/**
 * GET /api/integrations/gmail/callback
 * Gmail OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=${error}`
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
          appName: 'gmail',
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

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri =
      process.env.GMAIL_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_not_configured`
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Encrypt credentials before storing
    const credentialsToStore = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    };

    const encryptedCredentials = encrypt(JSON.stringify(credentialsToStore));

    // Store credentials
    await db.appIntegration.update({
      where: {
        userId_appName: {
          userId,
          appName: 'gmail',
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

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?success=gmail_connected`
    );
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_failed`
    );
  }
}
