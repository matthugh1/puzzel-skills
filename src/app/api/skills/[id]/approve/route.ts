import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';

type TransactionClient = typeof db;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/skills/:id/approve
 * Approve a skill version (requires approver or admin role)
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
    const { versionId, comments } = body;

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
        { error: `Cannot approve version with status: ${version.status}` },
        { status: 400 }
      );
    }

    // TODO: Re-enable self-approval prevention in production
    // Approvers cannot approve their own submissions
    // if (version.createdById === user.id) {
    //   return NextResponse.json(
    //     { error: 'Cannot approve your own submission' },
    //     { status: 403 }
    //   );
    // }

    // Use transaction to update version and skill atomically
    const result = await db.$transaction(async (tx: TransactionClient) => {
      // Update version status to published
      const updatedVersion = await tx.skillVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          approvedById: user.id,
          approvedAt: new Date(),
          changeNotes: comments ? `${version.changeNotes || ''}\n\nApproval note: ${comments}`.trim() : version.changeNotes,
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

      // Update skill status to published
      await tx.skill.update({
        where: { id },
        data: { status: 'PUBLISHED' },
      });

      return updatedVersion;
    });

    // Log audit
    await audit.versionApproved(versionId, user.id, {
      skillId: id,
      version: version.version,
      comments,
    }, request);

    return NextResponse.json({ version: result });
  } catch (error) {
    console.error('Approve version error:', error);
    return NextResponse.json(
      { error: 'Failed to approve version' },
      { status: 500 }
    );
  }
}
