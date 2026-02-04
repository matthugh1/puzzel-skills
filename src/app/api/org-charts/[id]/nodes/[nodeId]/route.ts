import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string; nodeId: string }>;
}

async function getParentNode(chartId: string, parentId?: string | null) {
  if (!parentId) return null;
  return db.orgNode.findFirst({
    where: { id: parentId, chartId },
  });
}

/**
 * PATCH /api/org-charts/:id/nodes/:nodeId
 * Update a node
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_WRITE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id, nodeId } = await context.params;

  try {
    const body = await validateRequestBody(request, validationSchemas.updateOrgNode);

    const existing = await db.orgNode.findFirst({
      where: { id: nodeId, chartId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Org node not found' }, { status: 404 });
    }

    if (existing.type === 'DEPARTMENT' && body.parentId !== undefined && body.parentId !== null) {
      return NextResponse.json({ error: 'Departments cannot have a parent' }, { status: 400 });
    }

    if (existing.type === 'TEAM' && body.parentId !== undefined) {
      if (body.parentId === null) {
        return NextResponse.json({ error: 'Teams must belong to a department' }, { status: 400 });
      }
      const parent = await getParentNode(id, body.parentId);
      if (!parent || parent.type !== 'DEPARTMENT') {
        return NextResponse.json({ error: 'Team parent must be a department' }, { status: 400 });
      }
    }

    if (existing.type === 'AGENT' && body.parentId !== undefined) {
      if (body.parentId === null) {
        return NextResponse.json({ error: 'Agents must belong to a team' }, { status: 400 });
      }
      const parent = await getParentNode(id, body.parentId);
      if (!parent || parent.type !== 'TEAM') {
        return NextResponse.json({ error: 'Agent parent must be a team' }, { status: 400 });
      }
    }

    const updateData: {
      name?: string;
      parentId?: string | null;
      roleTitle?: string;
      departmentLabel?: string;
      order?: number;
    } = {};

    if (body.name) updateData.name = body.name;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;
    if (body.roleTitle !== undefined) updateData.roleTitle = body.roleTitle;
    if (body.departmentLabel !== undefined) updateData.departmentLabel = body.departmentLabel;
    if (body.order !== undefined) updateData.order = body.order;

    const updated = await db.orgNode.update({
      where: { id: nodeId },
      data: updateData,
    });

    const moved = body.parentId !== undefined && body.parentId !== existing.parentId;

    await audit.orgNodeUpdated(updated.id, user.id, { type: updated.type, chartId: id }, request);

    if (moved) {
      await audit.orgNodeMoved(updated.id, user.id, { from: existing.parentId, to: body.parentId }, request);
    }

    return NextResponse.json({ node: updated });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update org node error:', error);
    return NextResponse.json({ error: 'Failed to update org node' }, { status: 500 });
  }
}

/**
 * DELETE /api/org-charts/:id/nodes/:nodeId
 * Delete a node
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_WRITE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id, nodeId } = await context.params;

  try {
    const existing = await db.orgNode.findFirst({
      where: { id: nodeId, chartId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Org node not found' }, { status: 404 });
    }

    await db.orgNode.delete({ where: { id: nodeId } });

    await audit.orgNodeDeleted(existing.id, user.id, { type: existing.type, chartId: id }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete org node error:', error);
    return NextResponse.json({ error: 'Failed to delete org node' }, { status: 500 });
  }
}
