import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getParentNode(chartId: string, parentId?: string) {
  if (!parentId) return null;
  return db.orgNode.findFirst({
    where: { id: parentId, chartId },
  });
}

/**
 * GET /api/org-charts/:id/nodes
 * List nodes for a chart
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.ORG_CHART_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { id } = await context.params;

  try {
    const chart = await db.orgChart.findUnique({ where: { id } });
    if (!chart) {
      return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
    }

    const nodes = await db.orgNode.findMany({
      where: { chartId: id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            ownerId: true,
          },
        },
      },
    });

    return NextResponse.json({ nodes });
  } catch (error) {
    console.error('List org nodes error:', error);
    return NextResponse.json({ error: 'Failed to load org nodes' }, { status: 500 });
  }
}

/**
 * POST /api/org-charts/:id/nodes
 * Create a node in a chart
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;

  try {
    const body = await validateRequestBody(request, validationSchemas.createOrgNode);

    const chart = await db.orgChart.findUnique({ where: { id } });
    if (!chart) {
      return NextResponse.json({ error: 'Org chart not found' }, { status: 404 });
    }

    if (body.type === 'DEPARTMENT' && body.parentId) {
      return NextResponse.json({ error: 'Departments cannot have a parent' }, { status: 400 });
    }

    if (body.type === 'TEAM') {
      if (!body.parentId) {
        return NextResponse.json({ error: 'Teams must belong to a department' }, { status: 400 });
      }
      const parent = await getParentNode(id, body.parentId);
      if (!parent || parent.type !== 'DEPARTMENT') {
        return NextResponse.json({ error: 'Team parent must be a department' }, { status: 400 });
      }
    }

    if (body.type === 'AGENT') {
      if (!body.parentId) {
        return NextResponse.json({ error: 'Agents must belong to a team' }, { status: 400 });
      }
      if (!body.agentId) {
        return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
      }
      const parent = await getParentNode(id, body.parentId);
      if (!parent || parent.type !== 'TEAM') {
        return NextResponse.json({ error: 'Agent parent must be a team' }, { status: 400 });
      }

      const agent = await db.agent.findUnique({ where: { id: body.agentId } });
      if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
      }

      if (!canModifyResource(user, agent.ownerId)) {
        return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
      }

      const existing = await db.orgNode.findFirst({
        where: { chartId: id, agentId: body.agentId },
      });
      if (existing) {
        return NextResponse.json({ error: 'Agent already exists in this chart' }, { status: 409 });
      }
    }

    const node = await db.orgNode.create({
      data: {
        chartId: id,
        type: body.type,
        name: body.name,
        parentId: body.parentId,
        agentId: body.agentId,
        roleTitle: body.roleTitle,
        departmentLabel: body.departmentLabel,
        order: body.order ?? 0,
      },
    });

    await audit.orgNodeCreated(node.id, user.id, { type: node.type, chartId: id }, request);

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create org node error:', error);
    return NextResponse.json({ error: 'Failed to create org node' }, { status: 500 });
  }
}
