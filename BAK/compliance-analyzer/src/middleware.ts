import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

const PLATFORM_CORE_URL = process.env.PLATFORM_CORE_URL || 'http://localhost:3000';

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    console.log('[Middleware] Processing:', path, 'hasToken:', !!req.nextauth.token);
    
    // SSO endpoint must be accessible without authentication - return early
    if (path === '/api/auth/sso') {
      console.log('[Middleware] Allowing SSO endpoint through');
      return NextResponse.next();
    }
    
    // If accessing auth pages, allow through
    if (path.startsWith('/auth')) {
      // If already authenticated and trying to access login, redirect to home
      if (path === '/auth/login' && req.nextauth.token) {
        return NextResponse.redirect(new URL('/', req.url));
      }
      return NextResponse.next();
    }

    // For API routes, check authentication (excluding NextAuth routes and SSO)
    if (path.startsWith('/api') && 
        !path.startsWith('/api/auth/')) {
      if (!req.nextauth.token) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // For protected pages (documents), require authentication
    if (path.startsWith('/documents')) {
      if (!req.nextauth.token) {
        // Redirect to platform-core login for seamless authentication
        return NextResponse.redirect(new URL(`${PLATFORM_CORE_URL}/auth/login?callbackUrl=${encodeURIComponent(req.url)}`));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        console.log('[Middleware] authorized check for:', path, 'hasToken:', !!token);
        
        // Always allow access to auth pages, SSO endpoint, and home page
        if (path.startsWith('/auth') || 
            path === '/' ||
            path === '/api/auth/sso') {
          console.log('[Middleware] Allowing access to:', path);
          return true;
        }
        // Require token for API routes and protected pages
        if (path.startsWith('/api') || 
            path.startsWith('/documents')) {
          console.log('[Middleware] Requiring token for:', path);
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/api/:path*',
    '/documents/:path*',
    '/auth/:path*',
  ],
};
