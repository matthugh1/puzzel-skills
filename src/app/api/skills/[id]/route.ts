import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import {
  checkAuthWithPermission,
  canModifyResource,
  PERMISSIONS,
} from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateCSRFToken } from '@/lib/csrf';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/skills/:id
 * Get a skill with its versions
 * Allows unauthenticated access to published skills only
 * Updated to support public access to published skills
 */
export async function GET(request: Request, context: RouteContext) {
  const user = await getUserFromRequest(request);
  const { id } = await context.params;

  const skill = await db.skill.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      versions: {
        orderBy: { version: 'desc' },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
          metadata: true,
        },
      },
    },
  });

  if (!skill) {
    return NextResponse.json(
      { error: 'Skill not found' },
      { status: 404 }
    );
  }

  // Check access: published skills visible to all, others only to owner/admin
  if (skill.status !== 'PUBLISHED') {
    // For non-published skills, require authentication and ownership
    if (!user) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
    if (!canModifyResource(user, skill.ownerId)) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }
  }

  // Get the latest published version content
  const latestPublished = skill.versions.find((v: { status: string }) => v.status === 'PUBLISHED');
  const latestVersion = skill.versions[0];

  return NextResponse.json({
    skill: {
      ...skill,
      latestPublishedVersion: latestPublished,
      latestVersion,
    },
  });
}

/**
 * PUT /api/skills/:id
 * Update skill metadata
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_UPDATE);

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

  const skill = await db.skill.findUnique({
    where: { id },
  });

  if (!skill) {
    return NextResponse.json(
      { error: 'Skill not found' },
      { status: 404 }
    );
  }

  // Check ownership (owner or admin can update)
  if (!canModifyResource(user, skill.ownerId)) {
    return NextResponse.json(
      { error: 'Forbidden: you do not own this skill' },
      { status: 403 }
    );
  }

  try {
    const body = await validateRequestBody(request, validationSchemas.updateSkill);
    const {
      name,
      description,
      category,
      tags,
      toolId,
      visibility,
      inputContract,
      outputContract,
    } = body;

    // Get old values for audit
    const oldValues = {
      name: skill.name,
      description: skill.description,
      category: skill.category,
      tags: skill.tags,
    };

    // Get latest version to update its metadata if toolId is provided
    const latestVersion = await db.skillVersion.findFirst({
      where: { skillId: id },
      orderBy: { version: 'desc' },
      include: { metadata: true },
    });

    const updatedSkill = await db.skill.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(tags && { tags }),
        ...(visibility && { visibility }),
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update latest version's metadata if toolId is provided in the request body
    // toolId can be: string (set tool), null/empty string (remove tool), or undefined (don't change)
    const toolIdProvided = 'toolId' in body;
    const toolIdValue = toolId && typeof toolId === 'string' ? toolId.trim() : null;
    const hasToolId = toolIdValue && toolIdValue.length > 0;
    const inputContractProvided = 'inputContract' in body;
    const outputContractProvided = 'outputContract' in body;
    const inputContractValue = inputContract ?? null;
    const outputContractValue = outputContract ?? null;

    if (latestVersion) {
      const metadataUpdates: Record<string, unknown> = {};

      if (toolIdProvided) {
        if (hasToolId) {
          const currentConfig = (latestVersion.metadata?.executorConfig as Record<string, unknown>) || {};
          metadataUpdates.executorConfig = {
            ...currentConfig,
            toolId: toolIdValue,
          };
        } else if (latestVersion.metadata) {
          const currentConfig = (latestVersion.metadata.executorConfig as Record<string, unknown>) || {};
          const { toolId: _, ...restConfig } = currentConfig;
          metadataUpdates.executorConfig = Object.keys(restConfig).length > 0 ? restConfig : null;
        }
      }

      if (inputContractProvided) {
        metadataUpdates.inputContract = inputContractValue;
      }

      if (outputContractProvided) {
        metadataUpdates.outputContract = outputContractValue;
      }

      const hasUpdate = Object.keys(metadataUpdates).length > 0;
      const shouldCreateMetadata = !latestVersion.metadata && (
        hasToolId ||
        (inputContractProvided && inputContractValue !== null) ||
        (outputContractProvided && outputContractValue !== null)
      );

      if (latestVersion.metadata && hasUpdate) {
        await db.skillVersionMetadata.update({
          where: { skillVersionId: latestVersion.id },
          data: metadataUpdates,
        });
      } else if (shouldCreateMetadata) {
        await db.skillVersionMetadata.create({
          data: {
            skillVersionId: latestVersion.id,
            capabilities: [],
            executorConfig: hasToolId ? { toolId: toolIdValue } : undefined,
            inputContract: inputContractValue ?? undefined,
            outputContract: outputContractValue ?? undefined,
          },
        });
      }
    }

    // Reload skill with updated metadata to return complete data
    const skillWithMetadata = await db.skill.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            metadata: true,
          },
        },
      },
    });

    // Log audit with old and new values
    await audit.skillUpdated(id, user.id, {
      oldValues,
      newValues: {
        name: updatedSkill.name,
        description: updatedSkill.description,
        category: updatedSkill.category,
        tags: updatedSkill.tags,
      },
    }, request);

    return NextResponse.json({ skill: skillWithMetadata || updatedSkill });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Skills] Update skill error:', error);
    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/skills/:id
 * Archive a skill (soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_DELETE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { id } = await context.params;

  const skill = await db.skill.findUnique({
    where: { id },
  });

  if (!skill) {
    return NextResponse.json(
      { error: 'Skill not found' },
      { status: 404 }
    );
  }

  // Check ownership (owner or admin can delete)
  if (!canModifyResource(user, skill.ownerId)) {
    return NextResponse.json(
      { error: 'Forbidden: you do not own this skill' },
      { status: 403 }
    );
  }

  try {
    // Soft delete by archiving
    await db.skill.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    // Log audit
    await audit.skillArchived(id, user.id, {
      skillName: skill.name,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete skill error:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
