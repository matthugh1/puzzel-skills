import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { rateLimit, RATE_LIMITS, trackFailedLogin, clearFailedLoginAttempts } from '@/lib/rate-limit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';

export async function POST(request: Request) {
  // Rate limiting - strict limits for authentication
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.AUTH);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const { email, password } = await validateRequestBody(request, validationSchemas.login);

    // Check if account is locked due to failed attempts
    const lockStatus = trackFailedLogin(email);
    if (lockStatus.locked) {
      return NextResponse.json(
        { error: 'Account temporarily locked due to too many failed attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const result = await auth.authenticate({ email, password });

    if (!result.success) {
      // Track failed attempt
      trackFailedLogin(email);
      // Log failed login attempt
      await audit.authFailed(email, { error: result.error }, request);
      return NextResponse.json(
        { error: 'Invalid credentials' }, // Generic error message
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    clearFailedLoginAttempts(email);

    // Log successful login
    if (!result.user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }

    await audit.authLogin(result.user.id, { email }, request);

    // Set JWT token as httpOnly cookie (more secure than localStorage)
    const cookieStore = await cookies();
    cookieStore.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Return user data
    // Token is now in httpOnly cookie, but also return for backward compatibility
    const response = NextResponse.json({
      user: result.user,
      token: result.token, // Legacy support - prefer reading from cookie
    });

    // Also set cookie in response headers (for immediate use)
    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
