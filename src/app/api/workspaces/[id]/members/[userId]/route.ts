import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * PATCH /api/workspaces/[id]/members/[userId]
 * Update a workspace member's role
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
  const { id, userId } = await context.params;

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

    // Check if member exists
    const member = await db.departmentWorkspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent changing owner role (only system admin can do this)
    if (member.role === 'OWNER' && !isSystemAdmin) {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 403 }
      );
    }

    // Validate input
    const body = await validateRequestBody(request, validationSchemas.updateWorkspaceMember);
    const { role } = body;

    // Update member role
    const updatedMember = await db.departmentWorkspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workspaceMemberRoleChanged(id, user.id, {
      workspaceName: workspace.name,
      memberUserId: userId,
      memberEmail: member.user.email,
      oldRole: member.role,
      newRole: role,
    }, request);

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update workspace member error:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]/members/[userId]
 * Remove a member from a workspace
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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
  const { id, userId } = await context.params;

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

    // Check if member exists
    const member = await db.departmentWorkspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prevent removing owner (only system admin can do this)
    if (member.role === 'OWNER' && !isSystemAdmin) {
      return NextResponse.json(
        { error: 'Cannot remove workspace owner' },
        { status: 403 }
      );
    }

    // Remove member
    await db.departmentWorkspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
    });

    // Log audit event
    await audit.workspaceMemberRemoved(id, user.id, {
      workspaceName: workspace.name,
      memberUserId: userId,
      memberEmail: member.user.email,
      role: member.role,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove workspace member error:', error);
    return NextResponse.json(
      { error: 'Failed to remove workspace member' },
      { status: 500 }
    );
  }
}
