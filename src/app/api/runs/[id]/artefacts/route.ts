import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/runs/:id/artefacts
 * Get artefacts for a run
 */
export async function GET(request: Request, context: RouteContext) {
  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
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
    const { id } = await context.params;

    // Verify run exists and user has access
    const run = await db.agentRun.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }

    // Check if user owns the run or is admin
    if (run.userId !== user.id && !user.roles.includes('admin')) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Load artefacts
    const artefacts = await db.runArtefact.findMany({
      where: { runId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        step: {
          select: { stepIndex: true, skillId: true },
        },
      },
    });

    // Check retention and redact if needed
    const now = new Date();
    const processedArtefacts = artefacts.map((artefact) => {
      if (artefact.retentionExpiresAt && artefact.retentionExpiresAt < now) {
        return {
          ...artefact,
          content: { redacted: true },
          contentRedacted: true,
        };
      }
      return artefact;
    });

    return NextResponse.json({ artefacts: processedArtefacts });
  } catch (error) {
    console.error('Get artefacts error:', error);
    return NextResponse.json(
      { error: 'Failed to get artefacts' },
      { status: 500 }
    );
  }
}
