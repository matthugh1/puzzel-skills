/**
 * Policy Validator
 * Validates plans and steps against RunPolicy constraints
 */

import type { RunPolicy, Skill, SkillVersionMetadata } from '@prisma/client';

export interface ValidationError {
  code: string;
  message: string;
}

export interface PlanStep {
  skillId: string;
  skillVersionId: string;
  inputs: Record<string, unknown>;
}

/**
 * Validate plan against policy
 */
export function validatePlan(
  plan: { steps: PlanStep[] },
  policy: RunPolicy,
  skills: Array<Skill & { metadata?: SkillVersionMetadata | null }>,
  initialContextSizeBytes: number
): { valid: true } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Check maxSteps
  if (plan.steps.length > policy.maxSteps) {
    errors.push({
      code: 'MAX_STEPS_EXCEEDED',
      message: `Plan has ${plan.steps.length} steps, but policy allows maximum ${policy.maxSteps}`,
    });
  }

  // Check maxInitialContextBytes
  if (initialContextSizeBytes > policy.maxInitialContextBytes) {
    errors.push({
      code: 'INITIAL_CONTEXT_TOO_LARGE',
      message: `Initial context size (${initialContextSizeBytes} bytes) exceeds policy limit (${policy.maxInitialContextBytes} bytes)`,
    });
  }

  // Validate each step
  for (const [index, step] of plan.steps.entries()) {
    const skill = skills.find((s) => s.id === step.skillId);
    if (!skill) {
      errors.push({
        code: 'SKILL_NOT_FOUND',
        message: `Step ${index}: Skill ${step.skillId} not found`,
      });
      continue;
    }

    // Check category restrictions
    if (skill.category) {
      if (policy.blockedCategories.includes(skill.category)) {
        errors.push({
          code: 'BLOCKED_CATEGORY',
          message: `Step ${index}: Category "${skill.category}" is blocked by policy`,
        });
      }
      if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(skill.category)) {
        errors.push({
          code: 'CATEGORY_NOT_ALLOWED',
          message: `Step ${index}: Category "${skill.category}" is not in allowed list`,
        });
      }
    }

    // Check tag restrictions
    for (const tag of skill.tags) {
      if (policy.blockedTags.includes(tag)) {
        errors.push({
          code: 'BLOCKED_TAG',
          message: `Step ${index}: Tag "${tag}" is blocked by policy`,
        });
      }
      if (policy.allowedTags.length > 0 && !policy.allowedTags.includes(tag)) {
        errors.push({
          code: 'TAG_NOT_ALLOWED',
          message: `Step ${index}: Tag "${tag}" is not in allowed list`,
        });
      }
    }

    // Check capability restrictions (from metadata)
    if (skill.metadata?.capabilities) {
      for (const capability of skill.metadata.capabilities) {
        if (policy.blockedCapabilities.includes(capability)) {
          errors.push({
            code: 'BLOCKED_CAPABILITY',
            message: `Step ${index}: Capability "${capability}" is blocked by policy`,
          });
        }
        if (policy.allowedCapabilities.length > 0 && !policy.allowedCapabilities.includes(capability)) {
          errors.push({
            code: 'CAPABILITY_NOT_ALLOWED',
            message: `Step ${index}: Capability "${capability}" is not in allowed list`,
          });
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate step against policy (for runtime checks)
 */
export function validateStep(
  skill: Skill & { metadata?: SkillVersionMetadata | null },
  policy: RunPolicy,
  stepIndex: number
): { valid: true } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Check category
  if (skill.category) {
    if (policy.blockedCategories.includes(skill.category)) {
      errors.push({
        code: 'BLOCKED_CATEGORY',
        message: `Step ${stepIndex}: Category "${skill.category}" is blocked`,
      });
    }
    if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(skill.category)) {
      errors.push({
        code: 'CATEGORY_NOT_ALLOWED',
        message: `Step ${stepIndex}: Category "${skill.category}" not allowed`,
      });
    }
  }

  // Check tags
  for (const tag of skill.tags) {
    if (policy.blockedTags.includes(tag)) {
      errors.push({
        code: 'BLOCKED_TAG',
        message: `Step ${stepIndex}: Tag "${tag}" is blocked`,
      });
    }
  }

  // Check capabilities
  if (skill.metadata?.capabilities) {
    for (const capability of skill.metadata.capabilities) {
      if (policy.blockedCapabilities.includes(capability)) {
        errors.push({
          code: 'BLOCKED_CAPABILITY',
          message: `Step ${stepIndex}: Capability "${capability}" is blocked`,
        });
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
