import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePasswordStrength } from '@/lib/password';
import { hashPassword } from '@/lib/auth/simple-auth';

/**
 * GET /api/users
 * List all users (admin only)
 */
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim().substring(0, 200);
  const role = searchParams.get('role')?.trim().substring(0, 100);

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.roles = {
      some: {
        role: {
          name: role,
        },
      },
    };
  }

  const users = await db.user.findMany({
    where,
    include: {
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      workspaceMemberships: {
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Transform to include role names and workspace memberships
  const usersWithRoles = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map((ur) => ur.role.name),
    workspaces: user.workspaceMemberships.map((wm) => ({
      id: wm.workspace.id,
      name: wm.workspace.name,
      slug: wm.workspace.slug,
      role: wm.role,
    })),
  }));

  return NextResponse.json({ users: usersWithRoles });
}

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export async function POST(request: Request) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user: currentUser } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, currentUser.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.createUser);
    const { email, name, password, roleIds } = body;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Validate password strength if provided
    let passwordHash: string | undefined;
    if (password) {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password does not meet requirements', details: passwordValidation.errors },
          { status: 400 }
        );
      }
      passwordHash = await hashPassword(password);
    }

    // Create user
    const newUser = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        authProvider: 'LOCAL',
        roles: roleIds && roleIds.length > 0 ? {
          create: roleIds.map((roleId: string) => ({
            roleId,
          })),
        } : undefined,
      },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Log audit
    await audit.userCreated(newUser.id, currentUser.id, {
      email: newUser.email,
      name: newUser.name,
    }, request);

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        roles: newUser.roles.map((ur) => ur.role.name),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
