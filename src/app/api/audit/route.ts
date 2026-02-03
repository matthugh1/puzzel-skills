import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/audit
 * Query audit logs with filtering and pagination
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.AUDIT_READ);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const resourceType = searchParams.get('resourceType');
  const resourceId = searchParams.get('resourceId');
  const userId = searchParams.get('userId');
  const action = searchParams.get('action');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (resourceId) {
    where.resourceId = resourceId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    where.action = action;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) {
      where.createdAt.gte = new Date(from);
    }
    if (to) {
      where.createdAt.lte = new Date(to);
    }
  }

  try {
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // Cap at 100
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error('Query audit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}
