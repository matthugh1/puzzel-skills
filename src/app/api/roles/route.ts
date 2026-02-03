import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/roles
 * List all roles with their permissions (admin only)
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const roles = await db.role.findMany({
    include: {
      permissions: {
        include: {
          permission: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rolesWithPermissions = roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    userCount: role._count.users,
    permissions: role.permissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      description: rp.permission.description,
    })),
  }));

  return NextResponse.json({ roles: rolesWithPermissions });
}
