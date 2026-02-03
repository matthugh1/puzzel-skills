import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { executeRun } from '@/lib/runtime/execution-engine';

/**
 * GET /api/runs
 * List agent runs for the current user
 */
export async function GET(request: Request) {
  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
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
    // Load runs for the user (or all if admin)
    const runs = await db.agentRun.findMany({
      where: user.roles.includes('admin') ? {} : { userId: user.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        policy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent runs
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('List runs error:', error);
    return NextResponse.json(
      { error: 'Failed to list runs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runs
 * Create a new agent run
 */
export async function POST(request: NextRequest) {
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

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.createRun);
    const { goal, initialContext, policyId, inputAllowlist, idempotencyKey } = body;

    // Check idempotency if key provided
    if (idempotencyKey) {
      const existingRun = await db.agentRun.findUnique({
        where: { idempotencyKey },
      });
      if (existingRun) {
        return NextResponse.json({ run: existingRun }, { status: 200 });
      }
    }

    // Load policy if provided
    let policy = null;
    if (policyId) {
      policy = await db.runPolicy.findUnique({
        where: { id: policyId },
      });
      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }
    } else {
      // Use default policy
      policy = await db.runPolicy.findFirst({
        where: { name: 'default' },
      });
    }

    // Validate initialContext size
    const initialContextSize = JSON.stringify(initialContext).length;
    const maxSize = policy?.maxInitialContextBytes ?? 100000;
    if (initialContextSize > maxSize) {
      return NextResponse.json(
        { error: `Initial context size (${initialContextSize} bytes) exceeds policy limit (${maxSize} bytes)` },
        { status: 400 }
      );
    }

    // Validate inputAllowlist semantics
    // null = use default, [] = allow nothing, populated = explicit allowlist
    let processedAllowlist: string[] | null = null;
    if (inputAllowlist !== undefined) {
      if (inputAllowlist === null) {
        processedAllowlist = null; // Use default
      } else if (Array.isArray(inputAllowlist)) {
        processedAllowlist = inputAllowlist.length === 0 ? [] : inputAllowlist; // Empty = allow nothing, populated = explicit
      }
    }

    // Create AgentRun record
    const run = await db.agentRun.create({
      data: {
        userId: user.id,
        goal,
        initialContext,
        policyId: policy?.id ?? null,
        inputAllowlist: processedAllowlist as unknown as Record<string, unknown> | null,
        status: 'PLANNING',
        idempotencyKey: idempotencyKey || null,
      },
      include: {
        policy: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.agentRunCreated(run.id, user.id, {
      goal: run.goal,
      policyId: run.policyId,
    }, request);

    // Trigger planning phase (async, don't wait)
    executeRun(run.id).catch((error) => {
      console.error('Error executing run:', error);
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create run error:', error);
    return NextResponse.json(
      { error: 'Failed to create run' },
      { status: 500 }
    );
  }
}
