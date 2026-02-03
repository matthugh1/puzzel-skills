/**
 * PUT /api/folders/:id - Update folder
 * DELETE /api/folders/:id - Delete folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { audit } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().cuid().optional().nullable(),
});

export async function PUT(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_UPDATE);
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
    // Load folder
    const folder = await db.folder.findUnique({
      where: { id },
    });

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (folder.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await validateRequestBody(request, updateFolderSchema);

    // If parentId is being changed, verify it exists and doesn't create a cycle
    if (body.parentId !== undefined && body.parentId !== folder.parentId) {
      if (body.parentId) {
        const parent = await db.folder.findUnique({
          where: { id: body.parentId },
        });

        if (!parent) {
          return NextResponse.json(
            { error: 'Parent folder not found' },
            { status: 404 }
          );
        }

        if (parent.ownerId !== user.id) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          );
        }

        // Check for circular reference (parent cannot be a descendant)
        let current: string | null = body.parentId;
        while (current) {
          if (current === id) {
            return NextResponse.json(
              { error: 'Cannot move folder into its own descendant' },
              { status: 400 }
            );
          }
          const parentFolder = await db.folder.findUnique({
            where: { id: current },
            select: { parentId: true },
          });
          current = parentFolder?.parentId || null;
        }
      }
    }

    // Update folder
    const updatedFolder = await db.folder.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
      },
    });

    // Log audit event
    await audit.workflowUpdated(folder.id, user.id, {
      folderUpdated: {
        name: updatedFolder.name,
        parentId: updatedFolder.parentId,
      },
    }, request);

    return NextResponse.json({ folder: updatedFolder });
  } catch (error) {
    console.error('Update folder error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_DELETE);
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
    // Load folder
    const folder = await db.folder.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            workflows: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (folder.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if folder has workflows or children
    if (folder._count.workflows > 0 || folder._count.children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with workflows or subfolders. Move or delete them first.' },
        { status: 400 }
      );
    }

    // Delete folder (cascade will handle children)
    await db.folder.delete({
      where: { id },
    });

    // Log audit event
    await audit.workflowArchived(folder.id, user.id, {
      folderDeleted: {
        name: folder.name,
      },
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
