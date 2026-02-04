import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { callLLM } from '@/lib/llm';
import { getDefaultModel } from '@/lib/llm/client';
import type { LLMProvider } from '@/lib/llm/types';
import { mergePromptWithInput } from '@/app/api/mcp/tools';

interface RouteContext {
  params: Promise<{ id: string; skillId: string }>;
}

/**
 * POST /api/workspaces/[id]/skills/[skillId]/execute
 * Execute a skill directly with provided inputs
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
  const { id: workspaceId, skillId } = await context.params;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.executeSkill);
    const { inputs } = body;

    // Verify workspace membership
    const workspace = await db.departmentWorkspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: user.id },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const isOwner = workspace.ownerId === user.id;
    const isMember = workspace.members.length > 0;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Load skill with latest published version
    const skill = await db.skill.findUnique({
      where: { id: skillId },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!skill || skill.versions.length === 0) {
      return NextResponse.json(
        { error: 'Skill not found or not published' },
        { status: 404 }
      );
    }

    const skillVersion = skill.versions[0];

    // Merge prompt with inputs
    const prompt = mergePromptWithInput(skillVersion.content, inputs);

    // Determine LLM provider
    let provider: LLMProvider;
    if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
    } else {
      return NextResponse.json(
        { error: 'No LLM provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }
    const model = getDefaultModel(provider);

    // Execute skill with LLM
    const llmResponse = await callLLM(
      prompt,
      { provider, model },
      undefined,
      undefined,
      undefined
    );

    // Log audit event
    await audit.skillExecuted(skillId, user.id, {
      workspaceId,
      inputs,
    }, request);

    return NextResponse.json({
      result: llmResponse.content,
      success: true,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Execute skill error:', error);
    return NextResponse.json(
      { error: 'Failed to execute skill', success: false },
      { status: 500 }
    );
  }
}
