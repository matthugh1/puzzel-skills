import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/categories
 * List all unique categories from skills (admin only)
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  // Get all unique categories
  const skills = await db.skill.findMany({
    select: {
      category: true,
    },
    distinct: ['category'],
    where: {
      category: {
        not: null,
      },
    },
    orderBy: {
      category: 'asc',
    },
  });

  const categories = skills
    .map((s) => s.category)
    .filter((cat): cat is string => cat !== null);

  // Count skills per category
  const categoryCounts = await db.skill.groupBy({
    by: ['category'],
    where: {
      category: {
        not: null,
      },
    },
    _count: {
      category: true,
    },
  });

  const categoriesWithCounts = categories.map((category) => {
    const count = categoryCounts.find((cc) => cc.category === category)?._count.category || 0;
    return {
      name: category,
      count,
    };
  });

  return NextResponse.json({ categories: categoriesWithCounts });
}
