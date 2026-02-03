import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePasswordStrength } from '@/lib/password';
import { hashPassword } from '@/lib/auth/simple-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/:id
 * Get a specific user (admin only)
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { id } = await context.params;

  const user = await db.user.findUnique({
    where: { id },
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

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map((ur) => ur.role.name),
      roleIds: user.roles.map((ur) => ur.roleId),
    },
  });
}

/**
 * PUT /api/users/:id
 * Update a user (admin only)
 */
export async function PUT(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.USERS_ADMIN);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user: currentUser } = authResult;
  const { id } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, currentUser.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.updateUser);
    const { name, email, roleIds, password } = body;

    const existingUser = await db.user.findUnique({
      where: { id },
      include: {
        roles: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update basic fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    // Update password if provided
    if (password) {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: 'Password does not meet requirements', details: passwordValidation.errors },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(password);
    }

    // Update roles if provided
    if (roleIds !== undefined) {
      // Delete existing roles
      await db.userRole.deleteMany({
        where: { userId: id },
      });

      // Add new roles
      if (roleIds.length > 0) {
        await db.userRole.createMany({
          data: roleIds.map((roleId: string) => ({
            userId: id,
            roleId,
          })),
        });
      }
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
    const oldRoles = existingUser.roles.map((ur) => ur.roleId);
    const newRoles = roleIds || oldRoles;
    if (JSON.stringify(oldRoles.sort()) !== JSON.stringify(newRoles.sort())) {
      await audit.userRoleChanged(id, currentUser.id, {
        oldRoles,
        newRoles,
      }, request);
    }

    await audit.userUpdated(id, currentUser.id, {
      name: updatedUser.name,
      email: updatedUser.email,
    }, request);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        roles: updatedUser.roles.map((ur) => ur.role.name),
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
