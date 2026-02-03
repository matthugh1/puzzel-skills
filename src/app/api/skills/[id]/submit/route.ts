import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, canModifyResource, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/skills/:id/submit
 * Submit a skill version for approval
 */
export async function POST(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_UPDATE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    // Get skill and version
    const skill = await db.skill.findUnique({
      where: { id },
    });

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (!canModifyResource(user, skill.ownerId)) {
      return NextResponse.json(
        { error: 'Forbidden: you do not own this skill' },
        { status: 403 }
      );
    }

    const version = await db.skillVersion.findFirst({
      where: {
        id: versionId,
        skillId: id,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    if (version.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Cannot submit version with status: ${version.status}` },
        { status: 400 }
      );
    }

    // Update version status to pending approval
    const updatedVersion = await db.skillVersion.update({
      where: { id: versionId },
      data: {
        status: 'PENDING_APPROVAL',
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update skill status if this is the first submission
    if (skill.status === 'DRAFT') {
      await db.skill.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL' },
      });
    }

    // Log audit
    await audit.versionSubmitted(versionId, user.id, {
      skillId: id,
      version: version.version,
    }, request);

    return NextResponse.json({ version: updatedVersion });
  } catch (error) {
    console.error('Submit for approval error:', error);
    return NextResponse.json(
      { error: 'Failed to submit for approval' },
      { status: 500 }
    );
  }
}
