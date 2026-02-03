/**
 * Execution Engine
 * Orchestrates sequential skill execution within agent runs
 */

import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { resolveContext } from './context-resolver';
import { interpretOutput } from './interpreter';
import { validateStep } from './policy-validator';
import { acquireLease, refreshLease, releaseLease, markStaleSteps } from './lease-manager';
import { handleCallTool } from '@/app/api/mcp/handlers/call';
import type { AgentRun, RunStep, RunPolicy, SkillVersionMetadata } from '@prisma/client';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const LEASE_TTL_SECONDS = 300;

/**
 * Execute a single agent run
 */
export async function executeRun(runId: string): Promise<void> {
  // Acquire lease
  const leaseAcquired = await acquireLease(runId, WORKER_ID, LEASE_TTL_SECONDS);
  if (!leaseAcquired) {
    throw new Error('Could not acquire run lease');
  }

  try {
    // Load run with relations
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      include: {
        policy: true,
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Check cancellation
    if (run.status === 'CANCELLED') {
      return; // Stop execution
    }

    // Check if blocked
    if (run.status === 'BLOCKED') {
      return; // Wait for approval
    }

    // Check max duration
    if (run.maxDurationSeconds && run.startedAt) {
      const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
      if (elapsed > run.maxDurationSeconds) {
        await db.agentRun.update({
          where: { id: runId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'max_duration_exceeded',
          },
        });
        return;
      }
    }

    // Execute planning if needed
    if (run.status === 'PLANNING') {
      await executePlanning(run);
      // Reload run after planning
      const updatedRun = await db.agentRun.findUnique({
        where: { id: runId },
        include: { policy: true },
      });
      if (!updatedRun || updatedRun.status !== 'RUNNING') {
        return;
      }
    }

    // Execute steps sequentially
    if (run.status === 'RUNNING' && run.plan) {
      await executeSteps(runId, run.plan as { steps: Array<{ skillId: string; skillVersionId: string; inputs: Record<string, unknown> }> }, run.policy);
    }
  } finally {
    // Release lease
    await releaseLease(runId, WORKER_ID);
  }
}

/**
 * Execute planning phase
 */
async function executePlanning(run: AgentRun & { policy: RunPolicy | null }): Promise<void> {
  // Import planning engine
  const { planningEngine } = await import('./planning');
  
  // Load available skills
  const skills = await db.skill.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: 'ORG',
    },
    include: {
      versions: {
        where: { status: 'PUBLISHED' },
        orderBy: { version: 'desc' },
        take: 1,
      },
      metadata: true,
    },
  });

  const initialContext = run.initialContext as Record<string, unknown>;
  
  // Generate plan
  const plan = await planningEngine.plan(run.goal, initialContext, skills);
  
  // Calculate plan hash
  const planContentHash = createHash('sha256')
    .update(JSON.stringify(plan))
    .digest('hex');

  // Validate plan against policy
  if (run.policy) {
    const { validatePlan } = await import('./policy-validator');
    const initialContextSize = JSON.stringify(initialContext).length;
    const validation = validatePlan(plan, run.policy, skills, initialContextSize);
    
    if (!validation.valid) {
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          blockedReason: validation.errors.map((e) => e.message).join('; '),
        },
      });
      return;
    }
  }

  // Check if approval required
  const requiresApproval = run.policy?.requiresApproval ?? false;
  
  // Update run with plan
  await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: requiresApproval ? 'BLOCKED' : 'RUNNING',
      plan,
      planContentHash,
      startedAt: run.startedAt || new Date(),
      blockedReason: requiresApproval ? 'approval_required' : null,
    },
  });

  // Create approval record if needed
  if (requiresApproval) {
    await db.runApproval.create({
      data: {
        runId: run.id,
        requestedBy: run.userId,
        reason: 'Policy requires approval before execution',
      },
    });
  }
}

/**
 * Execute steps sequentially
 */
async function executeSteps(
  runId: string,
  plan: { steps: Array<{ skillId: string; skillVersionId: string; inputs: Record<string, unknown> }> },
  policy: RunPolicy | null
): Promise<void> {
  // Load run and previous steps
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
    },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  const initialContext = run.initialContext as Record<string, unknown>;

  for (const [index, planStep] of plan.steps.entries()) {
    // Check cancellation before each step
    const currentRun = await db.agentRun.findUnique({
      where: { id: runId },
      select: { status: true, currentStepIndex: true },
    });
    
    if (currentRun?.status === 'CANCELLED') {
      return; // Stop execution
    }

    if (currentRun?.status === 'BLOCKED') {
      return; // Wait for approval
    }

    // Skip if step already completed
    if (index < (currentRun?.currentStepIndex ?? 0)) {
      continue;
    }

    // Refresh lease before step
    await refreshLease(runId, WORKER_ID, LEASE_TTL_SECONDS);

    // Execute step
    const stepResult = await executeStep(
      runId,
      index,
      planStep,
      initialContext,
      run.steps.filter((s) => s.stepIndex < index),
      policy
    );

    // Refresh lease after step
    await refreshLease(runId, WORKER_ID, LEASE_TTL_SECONDS);

    // Check cancellation after step
    const afterRun = await db.agentRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    
    if (afterRun?.status === 'CANCELLED') {
      return; // Stop execution
    }

    // If step failed and no retries left, fail run
    if (stepResult.status === 'FAILED' && !stepResult.retryable) {
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });
      return;
    }

    // If step succeeded, increment currentStepIndex
    if (stepResult.status === 'SUCCESS') {
      await db.agentRun.update({
        where: { id: runId },
        data: {
          currentStepIndex: index + 1,
        },
      });
    }
  }

  // All steps completed
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETE',
      completedAt: new Date(),
    },
  });
}

/**
 * Execute a single step
 */
async function executeStep(
  runId: string,
  stepIndex: number,
  planStep: { skillId: string; skillVersionId: string; inputs: Record<string, unknown> },
  initialContext: Record<string, unknown>,
  previousSteps: RunStep[],
  policy: RunPolicy | null
): Promise<{ status: 'SUCCESS' | 'FAILED'; retryable: boolean }> {
  // Load skill and version
  const skill = await db.skill.findUnique({
    where: { id: planStep.skillId },
    include: {
      metadata: true,
    },
  });

  const skillVersion = await db.skillVersion.findUnique({
    where: { id: planStep.skillVersionId },
  });

  if (!skill || !skillVersion) {
    throw new Error('Skill or version not found');
  }

  // Validate step against policy
  if (policy) {
    const validation = validateStep(skill, policy, stepIndex);
    if (!validation.valid) {
      await db.runStep.create({
        data: {
          runId,
          stepIndex,
          skillId: skill.id,
          skillVersionId: skillVersion.id,
          skillVersionContentHash: createHash('sha256').update(skillVersion.content).digest('hex'),
          status: 'FAILED',
          inputContext: planStep.inputs,
          errorMessage: validation.errors.map((e) => e.message).join('; '),
        },
      });
      return { status: 'FAILED', retryable: false };
    }
  }

  // Resolve input context
  const resolvedInputs = await resolveContext(planStep.inputs, initialContext, previousSteps);

  // Check input allowlist
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { inputAllowlist: true },
  });

  if (run?.inputAllowlist !== null) {
    const allowlist = run.inputAllowlist as string[] | null;
    const allowedFields = allowlist === null || allowlist.length === 0 
      ? [] // Empty array = allow nothing, null = use default
      : allowlist; // Populated = explicit allowlist
    
    // System default allowlist (if null, use default)
    const systemDefault = ['ticketId', 'ticketUrl', 'repo', 'branch', 'filePaths', 'mode', 'labels'];
    const effectiveAllowlist = allowlist === null ? systemDefault : allowedFields;
    
    // Filter inputs
    const filteredInputs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(resolvedInputs)) {
      if (effectiveAllowlist.includes(key)) {
        filteredInputs[key] = value;
      }
    }
    Object.assign(resolvedInputs, filteredInputs);
  }

  // Create step record
  const step = await db.runStep.create({
    data: {
      runId,
      stepIndex,
      skillId: skill.id,
      skillVersionId: skillVersion.id,
      skillVersionContentHash: createHash('sha256').update(skillVersion.content).digest('hex'),
      status: 'RUNNING',
      inputContext: resolvedInputs,
      startedAt: new Date(),
    },
  });

  try {
    // Execute skill via MCP handler
    const skillName = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    
    // Create mock request for MCP handler
    const mockRequest = new Request('http://localhost/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        method: 'tools/call',
        name: skillName,
        arguments: resolvedInputs,
      }),
    });

    // Get user from run
    const runUser = await db.agentRun.findUnique({
      where: { id: runId },
      select: { userId: true },
    });

    if (!runUser) {
      throw new Error('Run user not found');
    }

    // Call MCP handler (returns NextResponse)
    const mcpResponse = await handleCallTool(
      { name: skillName, arguments: resolvedInputs },
      runUser.userId,
      mockRequest,
      runId,
      stepIndex,
      step.id
    );

    const mcpData = await mcpResponse.json();
    const rawOutput = mcpData.content?.[0]?.text || '';

    // Interpret output
    const interpretation = interpretOutput(rawOutput, skill.metadata);
    
    if ('error' in interpretation) {
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          errorMessage: interpretation.error.message,
          completedAt: new Date(),
        },
      });
      return { status: 'FAILED', retryable: false };
    }

    const { output } = interpretation;

    // Check artefact limit
    const artefactCount = await db.runArtefact.count({
      where: { runId },
    });

    if (policy && artefactCount >= policy.maxArtefactsPerRun) {
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          errorMessage: 'artefact_limit_exceeded',
          completedAt: new Date(),
        },
      });
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });
      return { status: 'FAILED', retryable: false };
    }

    // Create artefact
    const artefact = await db.runArtefact.create({
      data: {
        stepId: step.id,
        runId,
        type: output.artefactType,
        content: output.data || { raw: output.raw },
        sensitivity: output.sensitivity,
        retentionExpiresAt: calculateRetentionExpiresAt(output.sensitivity),
      },
    });

    // Update step with output
    await db.runStep.update({
      where: { id: step.id },
      data: {
        status: 'SUCCESS',
        outputContext: {
          raw: output.raw,
          data: output.data,
          artefactRefs: [`artefact-${artefact.id}`],
        },
        completedAt: new Date(),
      },
    });

    return { status: 'SUCCESS', retryable: false };
  } catch (error) {
    await db.runStep.update({
      where: { id: step.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
    return { status: 'FAILED', retryable: true }; // Network errors are retryable
  }
}

/**
 * Calculate retention expiration date based on sensitivity
 */
function calculateRetentionExpiresAt(sensitivity: 'LOW' | 'MEDIUM' | 'HIGH'): Date {
  const now = new Date();
  const days = sensitivity === 'LOW' ? 90 : sensitivity === 'MEDIUM' ? 60 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
