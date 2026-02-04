import { NextResponse, NextRequest } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { toolsRegistry } from '@/lib/tools';

interface RouteContext {
  params: Promise<{ toolId: string }>;
}

/**
 * POST /api/tools/[toolId]/execute
 * Execute a tool directly with provided arguments
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const { toolId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.executeTool);
    const { arguments: args } = body;

    // Check if tool exists
    const tool = toolsRegistry.get(toolId);
    if (!tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      );
    }

    // Execute tool
    const toolResult = await toolsRegistry.execute(
      toolId,
      args,
      {
        userId: user.id,
      }
    );

    // Log audit event
    await audit.toolExecuted(toolId, user.id, {
      arguments: args,
      success: toolResult.success,
    }, request);

    return NextResponse.json({
      result: toolResult,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Execute tool error:', error);
    return NextResponse.json(
      { error: 'Failed to execute tool' },
      { status: 500 }
    );
  }
}
