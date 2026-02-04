import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkAuthWithPermission, PERMISSIONS, isAdmin } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';

/**
 * GET /api/workspaces
 * List department workspaces (filtered by permissions)
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  const { searchParams } = new URL(request.url);

  // Validate and sanitize search parameters
  const search = searchParams.get('search')?.trim().substring(0, 200);
  const isActive = searchParams.get('isActive');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  // Build where clause
  const where: Record<string, unknown> = {};

  // Filter by active status
  if (isActive === 'true') {
    where.isActive = true;
  } else if (isActive === 'false') {
    where.isActive = false;
  } else if (!includeInactive) {
    where.isActive = true; // Default to active only
  }

  // Search filter
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  // If authenticated, filter by membership or ownership
  if (user) {
    if (!isAdmin(user)) {
      // Non-admins can only see workspaces they own or are members of
      where.OR = [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
        ...(where.OR ? (Array.isArray(where.OR) ? where.OR : [where.OR]) : []),
      ];
    }
  } else {
    // Unauthenticated users cannot see workspaces
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const workspaces = await db.departmentWorkspace.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('List workspaces error:', error);
    return NextResponse.json(
      { error: 'Failed to list workspaces' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new department workspace
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKSPACES_CREATE);
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
    const body = await validateRequestBody(request, validationSchemas.createWorkspace);
    const { name, description, slug } = body;

    // Check if slug already exists
    const existingWorkspace = await db.departmentWorkspace.findUnique({
      where: { slug },
    });

    if (existingWorkspace) {
      return NextResponse.json(
        { error: 'A workspace with this slug already exists' },
        { status: 400 }
      );
    }

    // Create workspace with owner as first member
    const workspace = await db.departmentWorkspace.create({
      data: {
        name,
        description: description || null,
        slug,
        ownerId: user.id,
        isActive: true,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Log audit event
    await audit.workspaceCreated(workspace.id, user.id, {
      name: workspace.name,
      slug: workspace.slug,
    }, request);

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
