/**
 * GET /api/folders - List folders (tree structure)
 * POST /api/folders - Create folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { validateRequestBody } from '@/lib/validation';
import { z } from 'zod';
import { audit } from '@/lib/audit';

const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  parentId: z.string().cuid().optional().nullable(),
});

interface FolderNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  children?: FolderNode[];
  _count?: {
    workflows: number;
  };
}

/**
 * Build folder tree recursively
 */
function buildFolderTree(
  folders: FolderNode[],
  parentId: string | null = null
): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => ({
      ...folder,
      children: buildFolderTree(folders, folder.id),
    }));
}

export async function GET(request: NextRequest) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Get all folders owned by user
    const folders = await db.folder.findMany({
      where: { ownerId: user.id },
      include: {
        _count: {
          select: { workflows: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Build tree structure
    const tree = buildFolderTree(folders as FolderNode[]);

    return NextResponse.json({ folders: tree });
  } catch (error) {
    console.error('List folders error:', error);
    return NextResponse.json(
      { error: 'Failed to list folders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_CREATE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate request body
    const body = await validateRequestBody(request, createFolderSchema);

    // If parentId provided, verify it exists and belongs to user
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
    }

    // Create folder
    const folder = await db.folder.create({
      data: {
        name: body.name,
        description: body.description || null,
        parentId: body.parentId || null,
        ownerId: user.id,
      },
    });

    // Log audit event (using workflow audit for now - could add folder audit later)
    await audit.workflowCreated(folder.id, user.id, {
      folderCreated: {
        name: folder.name,
        parentId: folder.parentId,
      },
    }, request);

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error('Create folder error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}
