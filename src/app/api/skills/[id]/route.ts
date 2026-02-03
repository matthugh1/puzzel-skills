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
    const body = await request.json();
    console.log(`[API Skills] PUT /api/skills/${id} - Request body:`, JSON.stringify(body, null, 2));
    const { name, description, category, tags, toolId, visibility } = body;
    console.log(`[API Skills] Extracted fields:`, {
      toolId,
      toolIdType: typeof toolId,
      toolIdInBody: 'toolId' in body,
      visibility,
    });

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
    
    console.log(`[API Skills] toolId update check:`, {
      toolIdProvided,
      toolId,
      toolIdValue,
      hasToolId,
      hasLatestVersion: !!latestVersion,
    });
    
    if (toolIdProvided && latestVersion) {
      console.log(`[API Skills] Updating toolId for skill ${id}, version ${latestVersion.id}:`, {
        toolId,
        toolIdValue,
        toolIdType: typeof toolId,
        hasToolId,
        hasMetadata: !!latestVersion.metadata,
        currentExecutorConfig: latestVersion.metadata?.executorConfig,
      });
      
      if (hasToolId && latestVersion.metadata) {
        // Update existing metadata - merge with existing executorConfig
        const currentConfig = (latestVersion.metadata.executorConfig as Record<string, unknown>) || {};
        const updatedConfig = {
          ...currentConfig,
          toolId: toolIdValue,
        };
        const result = await db.skillVersionMetadata.update({
          where: { skillVersionId: latestVersion.id },
          data: {
            executorConfig: updatedConfig,
          },
        });
        console.log(`[API Skills] ✅ Updated executorConfig with toolId. Result:`, result.executorConfig);
      } else if (hasToolId && !latestVersion.metadata) {
        // Create new metadata
        const newConfig = {
          toolId: toolIdValue,
        };
        const result = await db.skillVersionMetadata.create({
          data: {
            skillVersionId: latestVersion.id,
            executorConfig: newConfig,
          },
        });
        console.log(`[API Skills] ✅ Created new metadata with toolId. Result:`, result.executorConfig);
      } else if (!hasToolId && latestVersion.metadata) {
        // Remove toolId from metadata (toolId is null or empty)
        const currentConfig = (latestVersion.metadata.executorConfig as Record<string, unknown>) || {};
        const { toolId: _, ...restConfig } = currentConfig;
        const updatedConfig = Object.keys(restConfig).length > 0 ? restConfig : null;
        const result = await db.skillVersionMetadata.update({
          where: { skillVersionId: latestVersion.id },
          data: {
            executorConfig: updatedConfig,
          },
        });
        console.log(`[API Skills] ✅ Removed toolId from executorConfig. Result:`, result.executorConfig);
      } else if (!hasToolId && !latestVersion.metadata) {
        console.log(`[API Skills] No toolId provided and no metadata exists - nothing to update`);
      }
    } else if (!toolIdProvided) {
      console.log(`[API Skills] toolId not provided in request body - skipping metadata update`);
    } else if (!latestVersion) {
      console.log(`[API Skills] ⚠️ No latest version found for skill ${id} - cannot update toolId`);
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

    // Log the final state to verify toolId was saved
    if (skillWithMetadata?.versions[0]?.metadata) {
      console.log(`[API Skills] ✅ Final skill metadata:`, {
        skillId: id,
        versionId: skillWithMetadata.versions[0].id,
        executorConfig: skillWithMetadata.versions[0].metadata.executorConfig,
        toolId: (skillWithMetadata.versions[0].metadata.executorConfig as Record<string, unknown>)?.toolId,
      });
    } else {
      console.log(`[API Skills] ⚠️ No metadata found in response for skill ${id}`);
    }

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
    console.error('[API Skills] Update skill error:', error);
    console.error('[API Skills] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Failed to update skill',
        details: error instanceof Error ? error.message : String(error),
      },
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
