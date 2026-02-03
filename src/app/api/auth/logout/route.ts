import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const user = await getUserFromRequest(request);

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await auth.revokeToken(token);
    }

    // Log logout if user was authenticated
    if (user) {
      await audit.authLogout(user.id, {}, request);
    }

    // Clear auth token cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('auth-token');
    
    // Also clear via cookies() API
    const cookieStore = await cookies();
    cookieStore.delete('auth-token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
