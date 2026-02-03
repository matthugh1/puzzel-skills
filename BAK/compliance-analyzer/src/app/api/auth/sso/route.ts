import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyToken } from '@shared/auth';
import type { JWTPayload } from '@shared/types';

/**
 * SSO endpoint for seamless authentication from platform-core
 * 
 * Flow:
 * 1. Platform-core generates a short-lived SSO token with user info
 * 2. Platform-core redirects to /api/auth/sso?token=...&callbackUrl=...
 * 3. This endpoint validates the token and creates a NextAuth session
 * 4. Redirects to callbackUrl (or /)
 */
export async function GET(request: NextRequest) {
  console.log('[SSO] Received SSO request:', request.url);
  try {
    const { searchParams } = new URL(request.url);
    const ssoToken = searchParams.get('token');
    const callbackUrl = searchParams.get('callbackUrl') || '/';

    console.log('[SSO] Token present:', !!ssoToken, 'Callback URL:', callbackUrl);

    if (!ssoToken) {
      console.error('[SSO] Missing SSO token');
      return NextResponse.redirect(
        new URL(`/auth/login?error=Configuration&message=Missing SSO token`, request.url)
      );
    }

    // Verify the SSO token from platform-core
    let payload: JWTPayload;
    try {
      payload = verifyToken(ssoToken);
      console.log('[SSO] Token verified, userId:', payload.userId, 'email:', payload.email);
    } catch (error) {
      console.error('[SSO] Token verification failed:', error);
      return NextResponse.redirect(
        new URL(`/auth/login?error=Verification&message=Invalid or expired SSO token`, request.url)
      );
    }

    // Check if user already has a valid NextAuth session
    const existingToken = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
    });

    // If already authenticated with same user, just redirect
    if (existingToken && existingToken.id === payload.userId) {
      return NextResponse.redirect(new URL(callbackUrl, request.url));
    }

    // Redirect to a special callback page that will create the session
    const callbackUrlWithToken = new URL('/auth/callback', request.url);
    callbackUrlWithToken.searchParams.set('token', ssoToken);
    callbackUrlWithToken.searchParams.set('userId', payload.userId);
    callbackUrlWithToken.searchParams.set('email', payload.email);
    callbackUrlWithToken.searchParams.set('redirect', callbackUrl);

    console.log('[SSO] Redirecting to callback:', callbackUrlWithToken.toString());
    return NextResponse.redirect(callbackUrlWithToken);
  } catch (error: any) {
    console.error('SSO error:', error);
    return NextResponse.redirect(
      new URL(`/auth/login?error=Configuration&message=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
