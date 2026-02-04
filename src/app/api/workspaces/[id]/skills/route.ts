import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/workspaces/[id]/skills
 * List workspace-scoped skills
 * For now, returns all org-level published skills (workspace scoping will come later)
 */
export async function GET(request: Request, context: RouteContext) {
  const user = await getUserFromRequest(request);
  const { id } = await context.params;

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Verify workspace exists and user is member
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

    const isOwner = workspace.ownerId === user.id;
    const isMember = workspace.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // For now, return all org-level published skills
    // TODO: Filter by workspaceId when schema is updated
    const skills = await db.skill.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'ORG',
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            metadata: {
              select: {
                inputContract: true,
                outputContract: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform the response to flatten metadata
    const transformedSkills = skills.map((skill) => ({
      ...skill,
      versions: skill.versions.map((version) => ({
        id: version.id,
        version: version.version,
        inputContract: version.metadata?.inputContract || null,
        outputContract: version.metadata?.outputContract || null,
      })),
    }));

    return NextResponse.json({ skills: transformedSkills });
  } catch (error) {
    console.error('Get workspace skills error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage, error);
    return NextResponse.json(
      { error: 'Failed to get workspace skills', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
