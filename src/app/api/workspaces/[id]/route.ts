import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspaces/[id]
 * Get a specific workspace
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
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

    return NextResponse.json({ workspace });
  } catch (error) {
    console.error('Get workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to get workspace' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/[id]
 * Update a workspace
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
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if workspace exists
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
    const body = await validateRequestBody(request, validationSchemas.updateWorkspace);
    const { name, description, slug, isActive } = body;

    // Check if slug is being changed and already exists
    if (slug && slug !== workspace.slug) {
      const existingWorkspace = await db.departmentWorkspace.findUnique({
        where: { slug },
      });

      if (existingWorkspace) {
        return NextResponse.json(
          { error: 'A workspace with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update workspace
    const updatedWorkspace = await db.departmentWorkspace.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(slug !== undefined && { slug }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Log audit event
    await audit.workspaceUpdated(updatedWorkspace.id, user.id, {
      name: updatedWorkspace.name,
      slug: updatedWorkspace.slug,
      changes: body,
    }, request);

    return NextResponse.json({ workspace: updatedWorkspace });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to update workspace' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]
 * Delete a workspace (soft delete by setting isActive to false)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKSPACES_DELETE);
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
    // Check if workspace exists
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Only owner or system admin can delete
    if (workspace.ownerId !== user.id && !isAdmin(user)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    const deletedWorkspace = await db.departmentWorkspace.update({
      where: { id },
      data: { isActive: false },
    });

    // Log audit event
    await audit.workspaceDeleted(deletedWorkspace.id, user.id, {
      name: deletedWorkspace.name,
      slug: deletedWorkspace.slug,
    }, request);

    return NextResponse.json({ workspace: deletedWorkspace });
  } catch (error) {
    console.error('Delete workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workspace' },
      { status: 500 }
    );
  }
}
