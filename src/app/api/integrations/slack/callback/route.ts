/**
 * GET /api/integrations/slack/callback
 * Slack OAuth callback handler
 */

import { NextRequest, NextResponse } from 'next/server';
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
          appName: 'slack',
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

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri =
      process.env.SLACK_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/slack/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_not_configured`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      throw new Error(tokenData.error || 'Failed to exchange code for token');
    }

    // Encrypt credentials before storing
    const credentialsToStore = {
      accessToken: tokenData.authed_user?.access_token,
      botToken: tokenData.access_token, // Bot token
      teamId: tokenData.team?.id,
      userId: tokenData.authed_user?.id,
    };

    const encryptedCredentials = encrypt(JSON.stringify(credentialsToStore));

    // Store credentials
    await db.appIntegration.update({
      where: {
        userId_appName: {
          userId,
          appName: 'slack',
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
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?success=slack_connected`
    );
  } catch (error) {
    console.error('Slack OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/integrations?error=oauth_failed`
    );
  }
}
