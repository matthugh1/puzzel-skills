import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * GET /api/skills
 * List skills (filtered by permission level)
 * Allows unauthenticated access to published skills only
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  const { searchParams } = new URL(request.url);

  // Validate and sanitize search parameters
  const category = searchParams.get('category')?.trim().substring(0, 100);
  const search = searchParams.get('search')?.trim().substring(0, 200);
  const status = searchParams.get('status') as 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED' | null;

  // Build where clause
  const where: Record<string, unknown> = {};

  // If unauthenticated, only show published skills
  if (!user) {
    where.status = 'PUBLISHED';
  } else {
    // Authenticated users: non-admins can see published skills or their own
    if (!user.roles.includes('admin')) {
      where.OR = [
        { status: 'PUBLISHED' },
        { ownerId: user.id },
      ];
    } else if (status) {
      where.status = status;
    }
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.AND = [
      where.AND || {},
      {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const skills = await db.skill.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  return NextResponse.json({ skills });
}

/**
 * POST /api/skills
 * Create a new skill with initial version
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_CREATE);

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
    const body = await validateRequestBody(request, validationSchemas.createSkill);
    const {
      name,
      description,
      category,
      tags,
      content,
      visibility,
      toolId,
      inputContract,
      outputContract,
    } = body;

    const hasMetadata = Boolean(toolId || inputContract || outputContract);

    // Create skill with initial version in a transaction
    const skill = await db.skill.create({
      data: {
        name,
        description,
        category,
        tags: tags || [],
        visibility: visibility || 'ORG',
        status: 'DRAFT',
        ownerId: user.id,
        versions: {
          create: {
            version: 1,
            content,
            status: 'DRAFT',
            createdById: user.id,
            metadata: hasMetadata
              ? {
                  create: {
                    capabilities: [],
                    executorConfig: toolId ? { toolId } : undefined,
                    inputContract: inputContract || undefined,
                    outputContract: outputContract || undefined,
                  },
                }
              : undefined,
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        versions: true,
      },
    });

    // Log audit
    await audit.skillCreated(skill.id, user.id, {
      name: skill.name,
      category: skill.category,
      visibility: skill.visibility,
    }, request);

    // Also log version creation
    if (skill.versions[0]) {
      await audit.versionCreated(skill.versions[0].id, user.id, {
        skillId: skill.id,
        version: skill.versions[0].version,
      }, request);
    }

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create skill error:', error);
    return NextResponse.json(
      { error: 'Failed to create skill' },
      { status: 500 }
    );
  }
}
