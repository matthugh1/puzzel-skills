import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/approvals
 * Get all skills/versions pending approval
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_APPROVE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const submitter = searchParams.get('submitter');

  // Find all versions with PENDING_APPROVAL status
  const where: Record<string, unknown> = {
    status: 'PENDING_APPROVAL',
  };

  const andConditions: Record<string, unknown>[] = [];

  if (category) {
    andConditions.push({
      skill: {
        category,
      },
    });
  }

  if (submitter) {
    andConditions.push({
      createdBy: {
        OR: [
          { email: { contains: submitter, mode: 'insensitive' } },
          { name: { contains: submitter, mode: 'insensitive' } },
        ],
      },
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const versions = await db.skillVersion.findMany({
    where,
    orderBy: { createdAt: 'asc' }, // Oldest first
    include: {
      skill: {
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({ versions });
}
