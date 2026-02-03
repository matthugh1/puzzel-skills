/**
 * POST /api/integrations/slack/connect
 * Initiate Slack OAuth flow
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
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri =
      process.env.SLACK_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/slack/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Slack OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Build OAuth URL
    const scopes = ['chat:write', 'channels:read', 'channels:manage', 'groups:read', 'groups:write'];
    const authUrl = `https://slack.com/oauth/v2/authorize?${new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state: JSON.stringify({ userId: user.id, stateToken: state }),
    }).toString()}`;

    // Store OAuth state in database
    await db.appIntegration.upsert({
      where: {
        userId_appName: {
          userId: user.id,
          appName: 'slack',
        },
      },
      create: {
        userId: user.id,
        appName: 'slack',
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
    console.error('Slack OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Slack OAuth' },
      { status: 500 }
    );
  }
}
