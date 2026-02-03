/**
 * POST /api/integrations/gmail/connect
 * Initiate Gmail OAuth flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
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
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri =
      process.env.GMAIL_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/integrations/gmail/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Gmail OAuth not configured' },
        { status: 500 }
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Generate OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ];

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString('hex');

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify({ userId: user.id, stateToken: state }),
      prompt: 'consent', // Force consent screen to get refresh token
    });

    // Store OAuth state in database
    await db.appIntegration.upsert({
      where: {
        userId_appName: {
          userId: user.id,
          appName: 'gmail',
        },
      },
      create: {
        userId: user.id,
        appName: 'gmail',
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
    console.error('Gmail OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail OAuth' },
      { status: 500 }
    );
  }
}
