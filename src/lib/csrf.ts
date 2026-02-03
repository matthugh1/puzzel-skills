/**
 * CSRF Protection Utilities
 * Validates CSRF tokens for state-changing operations
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate CSRF token from request
 * Returns error response if invalid, null if valid
 */
export function validateCSRFToken(request: NextRequest): NextResponse | null {
  // Only check CSRF for state-changing methods
  const method = request.method;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null; // No CSRF check needed for GET/HEAD/OPTIONS
  }

  // Skip CSRF check for certain endpoints (e.g., webhooks, public APIs)
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/webhooks/')) {
    return null; // Webhooks may have their own authentication
  }

  // Get CSRF token from header
  const token = request.headers.get('X-CSRF-Token') || request.headers.get('x-csrf-token');
  const cookieToken = request.cookies.get('csrf-token')?.value;

  if (!token || !cookieToken) {
    return NextResponse.json(
      { error: 'CSRF token missing' },
      { status: 403 }
    );
  }

  if (token !== cookieToken) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  return null; // Valid token
}

/**
 * Get CSRF token from cookies (for frontend)
 */
export function getCSRFToken(request: NextRequest): string | null {
  return request.cookies.get('csrf-token')?.value || null;
}
