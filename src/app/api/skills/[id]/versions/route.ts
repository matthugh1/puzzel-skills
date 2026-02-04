import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateCSRFToken } from '@/lib/csrf';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';

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
export async function POST(request: NextRequest, context: RouteContext) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_UPDATE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  const skill = await db.skill.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1,
        include: { metadata: true },
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
    const body = await validateRequestBody(request, validationSchemas.createVersion);
    const { content, changeNotes, inputContract, outputContract } = body;

    // Calculate next version number
    const latestVersion = skill.versions[0];
    const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const metadataFromLatest = latestVersion?.metadata
      ? {
        inputContract: latestVersion.metadata.inputContract ?? undefined,
        outputContract: latestVersion.metadata.outputContract ?? undefined,
        capabilities: latestVersion.metadata.capabilities,
        preferredInputs: latestVersion.metadata.preferredInputs ?? undefined,
        maxRetries: latestVersion.metadata.maxRetries ?? undefined,
        timeoutSeconds: latestVersion.metadata.timeoutSeconds ?? undefined,
        requiresApproval: latestVersion.metadata.requiresApproval,
        executorConfig: latestVersion.metadata.executorConfig ?? undefined,
      }
      : null;

    const hasMetadata = Boolean(
      metadataFromLatest ||
      inputContract ||
      outputContract
    );

    const version = await db.skillVersion.create({
      data: {
        version: nextVersionNumber,
        content,
        changeNotes,
        status: 'DRAFT',
        skillId: id,
        createdById: user.id,
        metadata: hasMetadata
          ? {
              create: {
                ...(metadataFromLatest || {}),
                capabilities: metadataFromLatest?.capabilities ?? [],
                inputContract: inputContract || metadataFromLatest?.inputContract,
                outputContract: outputContract || metadataFromLatest?.outputContract,
              },
            }
          : undefined,
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
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create version error:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
