import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspaces/[id]/members
 * List workspace members
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ members: workspace.members });
  } catch (error) {
    console.error('List workspace members error:', error);
    return NextResponse.json(
      { error: 'Failed to list workspace members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[id]/members
 * Add a member to a workspace
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKSPACES_UPDATE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if workspace exists and user has permission
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: user.id },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Check permissions: owner, admin member, or system admin
    const isOwner = workspace.ownerId === user.id;
    const isAdminMember = workspace.members.some(
      (m) => m.userId === user.id && (m.role === 'OWNER' || m.role === 'ADMIN')
    );
    const isSystemAdmin = isAdmin(user);

    if (!isOwner && !isAdminMember && !isSystemAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate input
    const body = await validateRequestBody(request, validationSchemas.addWorkspaceMember);
    const { userId, role } = body;

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = await db.departmentWorkspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      );
    }

    // Add member
    const member = await db.departmentWorkspaceMember.create({
      data: {
        workspaceId: id,
        userId,
        role: role || 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workspaceMemberAdded(id, user.id, {
      workspaceName: workspace.name,
      memberUserId: userId,
      memberEmail: targetUser.email,
      role: member.role,
    }, request);

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Add workspace member error:', error);
    return NextResponse.json(
      { error: 'Failed to add workspace member' },
      { status: 500 }
    );
  }
}
