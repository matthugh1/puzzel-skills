import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skills/:id/versions
 * List all versions of a skill
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { id } = await context.params;

  const skill = await db.skill.findUnique({
    where: { id },
    select: { id: true, status: true, ownerId: true },
  });

  if (!skill) {
    return NextResponse.json(
      { error: 'Skill not found' },
      { status: 404 }
    );
  }

  const versions = await db.skillVersion.findMany({
    where: { skillId: id },
    orderBy: { version: 'desc' },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
      metadata: true, // Include metadata so toolId is available
    },
  });

  return NextResponse.json({ versions });
}

/**
 * POST /api/skills/:id/versions
 * Create a new version of a skill
 */
export async function POST(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_UPDATE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  const skill = await db.skill.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });

  if (!skill) {
    return NextResponse.json(
      { error: 'Skill not found' },
      { status: 404 }
    );
  }

  // Check ownership (owner or admin can create versions)
  const isOwner = user.id === skill.ownerId;
  const isAdmin = user.roles.includes('admin');

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: you do not own this skill' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { content, changeNotes } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Calculate next version number
    const latestVersion = skill.versions[0];
    const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const version = await db.skillVersion.create({
      data: {
        version: nextVersionNumber,
        content,
        changeNotes,
        status: 'DRAFT',
        skillId: id,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit
    await audit.versionCreated(version.id, user.id, {
      skillId: id,
      version: nextVersionNumber,
    }, request);

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error('Create version error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
