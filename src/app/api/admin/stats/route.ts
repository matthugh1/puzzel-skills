import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/admin/stats
 * Get dashboard statistics (admin only)
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Skills stats
    const [totalSkills, draftSkills, pendingSkills, publishedSkills, archivedSkills] = await Promise.all([
      db.skill.count(),
      db.skill.count({ where: { status: 'DRAFT' } }),
      db.skill.count({ where: { status: 'PENDING_APPROVAL' } }),
      db.skill.count({ where: { status: 'PUBLISHED' } }),
      db.skill.count({ where: { status: 'ARCHIVED' } }),
    ]);

    // User stats
    const totalUsers = await db.user.count();
    const usersByRole = await db.userRole.groupBy({
      by: ['roleId'],
      _count: true,
    });

    const roles = await db.role.findMany({
      select: { id: true, name: true },
    });

    const usersByRoleMap: Record<string, number> = {};
    for (const role of roles) {
      const count = usersByRole.find((ubr) => ubr.roleId === role.id)?._count || 0;
      usersByRoleMap[role.name] = count;
    }

    // Approval stats
    const pendingApprovals = await db.skillVersion.count({
      where: { status: 'PENDING_APPROVAL' },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [approvedThisWeek, rejectedThisWeek] = await Promise.all([
      db.skillVersion.count({
        where: {
          status: 'PUBLISHED',
          approvedAt: {
            gte: oneWeekAgo,
          },
        },
      }),
      db.skillVersion.count({
        where: {
          status: 'REJECTED',
          approvedAt: {
            gte: oneWeekAgo,
          },
        },
      }),
    ]);

    // Recent activity (last 10 audit logs)
    const recentActivity = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      skills: {
        total: totalSkills,
        draft: draftSkills,
        pending: pendingSkills,
        published: publishedSkills,
        archived: archivedSkills,
      },
      users: {
        total: totalUsers,
        byRole: usersByRoleMap,
      },
      approvals: {
        pending: pendingApprovals,
        approvedThisWeek,
        rejectedThisWeek,
      },
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        userId: log.userId,
        user: log.user,
        details: log.details,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
