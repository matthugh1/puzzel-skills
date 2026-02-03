import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/skills/:id/reject
 * Reject a skill version (requires approver or admin role)
 */
export async function POST(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_APPROVE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  try {
    const body = await request.json();
    const { versionId, reason } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
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

    if (version.status !== 'PENDING_APPROVAL') {
      return NextResponse.json(
        { error: `Cannot reject version with status: ${version.status}` },
        { status: 400 }
      );
    }

    // Update version status to rejected
    const updatedVersion = await db.skillVersion.update({
      where: { id: versionId },
      data: {
        status: 'REJECTED',
        approvedById: user.id, // Track who rejected
        approvedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // If skill has no published versions, revert to draft status
    const hasPublishedVersion = await db.skillVersion.findFirst({
      where: {
        skillId: id,
        status: 'PUBLISHED',
      },
    });

    if (!hasPublishedVersion) {
      await db.skill.update({
        where: { id },
        data: { status: 'DRAFT' },
      });
    }

    // Log audit
    await audit.versionRejected(versionId, user.id, {
      skillId: id,
      version: version.version,
      reason,
    }, request);

    return NextResponse.json({ version: updatedVersion });
  } catch (error) {
    console.error('Reject version error:', error);
    return NextResponse.json(
      { error: 'Failed to reject version' },
      { status: 500 }
    );
  }
}
