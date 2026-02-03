import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Get the authenticated user ID from the NextAuth token
 * For API routes (with NextRequest)
 */
export async function getUserId(request: NextRequest): Promise<string | null>;
/**
 * Get the authenticated user ID from the NextAuth session
 * For server components (without NextRequest)
 */
export async function getUserId(): Promise<string | null>;
export async function getUserId(request?: NextRequest): Promise<string | null> {
  if (request) {
    // API route - use getToken with secret
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
    });
    return (token?.id as string) || null;
  } else {
    // Server component - use getServerSession
    const session = await getServerSession(authOptions);
    return (session?.user?.id as string) || null;
  }
}

/**
 * Require a user ID, throwing an error if not authenticated
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const userId = await getUserId(request);
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
