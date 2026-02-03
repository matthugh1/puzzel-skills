import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkAuthWithPermission, PERMISSIONS, canModifyResource } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * GET /api/workflows
 * List workflows (filtered by visibility/permissions)
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  const { searchParams } = new URL(request.url);

  // Validate and sanitize search parameters
  const category = searchParams.get('category')?.trim().substring(0, 100);
  const search = searchParams.get('search')?.trim().substring(0, 200);
  const status = searchParams.get('status') as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null;
  const visibility = searchParams.get('visibility') as 'TEAM' | 'ORG' | null;
  const includeArchived = searchParams.get('includeArchived') === 'true';
  const folderId = searchParams.get('folderId')?.trim();

  // Build where clause
  const where: Record<string, unknown> = {};

  // By default, exclude archived workflows unless explicitly requested
  if (!includeArchived) {
    where.archivedAt = null;
  }

  // Build base conditions array for OR clause
  const orConditions: Record<string, unknown>[] = [];

  // If unauthenticated, only show published workflows with ORG visibility
  if (!user) {
    const condition: Record<string, unknown> = {
      status: 'PUBLISHED',
      visibility: 'ORG',
    };
    if (folderId) {
      condition.folderId = folderId === 'null' ? null : folderId;
    }
    if (category) {
      condition.category = category;
    }
    orConditions.push(condition);
  } else {
    // Authenticated users: filter by visibility and ownership
    if (!user.roles.includes('admin')) {
      // Published workflows visible to org
      const orgCondition: Record<string, unknown> = {
        status: 'PUBLISHED',
        visibility: 'ORG',
      };
      if (folderId) {
        orgCondition.folderId = folderId === 'null' ? null : folderId;
      }
      if (category) {
        orgCondition.category = category;
      }
      orConditions.push(orgCondition);

      // User's own workflows
      const ownCondition: Record<string, unknown> = {
        ownerId: user.id,
      };
      if (folderId) {
        ownCondition.folderId = folderId === 'null' ? null : folderId;
      }
      if (category) {
        ownCondition.category = category;
      }
      orConditions.push(ownCondition);

      // Team workflows
      const teamCondition: Record<string, unknown> = {
        status: 'PUBLISHED',
        visibility: 'TEAM',
      };
      if (folderId) {
        teamCondition.folderId = folderId === 'null' ? null : folderId;
      }
      if (category) {
        teamCondition.category = category;
      }
      orConditions.push(teamCondition);
    } else {
      // Admins
      const adminCondition: Record<string, unknown> = {};
      if (status) {
        adminCondition.status = status;
      }
      if (folderId) {
        adminCondition.folderId = folderId === 'null' ? null : folderId;
      }
      if (category) {
        adminCondition.category = category;
      }
      if (visibility) {
        adminCondition.visibility = visibility;
      }
      if (Object.keys(adminCondition).length > 0) {
        orConditions.push(adminCondition);
      }
    }
  }

  // Apply OR conditions
  if (orConditions.length > 0) {
    if (orConditions.length === 1) {
      Object.assign(where, orConditions[0]);
    } else {
      where.OR = orConditions;
    }
  }

  // Add visibility filter for authenticated users (if not already in OR)
  if (visibility && user && user.roles.includes('admin') && !where.OR) {
    where.visibility = visibility;
  }

  // Add search filter (applies to all conditions using AND)
  if (search) {
    const searchCondition = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };
    
    // Combine with existing conditions using AND
    if (Object.keys(where).length > 0) {
      where.AND = [
        Object.keys(where).reduce((acc, key) => {
          if (key !== 'archivedAt') {
            acc[key] = where[key];
          }
          return acc;
        }, {} as Record<string, unknown>),
        searchCondition,
      ];
      // Keep archivedAt at top level
      if (where.archivedAt !== undefined) {
        const archivedAt = where.archivedAt;
        delete where.archivedAt;
        where.archivedAt = archivedAt;
      }
    } else {
      Object.assign(where, searchCondition);
    }
  }

  const workflows = await db.workflow.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { runs: true },
      },
    },
    take: 100, // Limit results
  });

  return NextResponse.json({ workflows });
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_CREATE);
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
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.createWorkflow);
    const { name, description, category, tags, plan, visibility, llmProvider, llmModel } = body;

    // Create workflow
    const workflow = await db.workflow.create({
      data: {
        name,
        description,
        category,
        tags: tags || [],
        plan: plan as Record<string, unknown>,
        visibility: visibility || 'ORG',
        status: 'DRAFT',
        ownerId: user.id,
        llmProvider: llmProvider || null,
        llmModel: llmModel || null,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.workflowCreated(workflow.id, user.id, {
      name: workflow.name,
      category: workflow.category,
      visibility: workflow.visibility,
    }, request);

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
