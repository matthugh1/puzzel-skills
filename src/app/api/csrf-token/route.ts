import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/csrf-token
 * Returns the CSRF token from the cookie
 * This endpoint exists to ensure the middleware runs and sets the cookie
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('csrf-token')?.value;
  
  if (!token) {
    // If no token, return 404 - middleware should have set it
    // This will trigger the client to retry
    return NextResponse.json(
      { error: 'CSRF token not available' },
      { status: 404 }
    );
  }

  return NextResponse.json({ token });
}
