import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validationSchemas } from '@/lib/validation';

/**
 * GET /api/align/coalition/users
 * Search users for coalition picker
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ALIGN_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() ?? '';

  const parsed = validationSchemas.alignUserSearch.safeParse({ search });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid search query', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const users = await db.user.findMany({
    where: {
      OR: [
        { email: { contains: parsed.data.search, mode: 'insensitive' } },
        { name: { contains: parsed.data.search, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
    orderBy: { email: 'asc' },
  });

  return NextResponse.json({ users });
}
