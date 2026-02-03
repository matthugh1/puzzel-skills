/**
 * Planning Engine Stub
 * Returns hardcoded plans for MVP testing
 * Future: Replace with LLM-based planning
 */

import type { Skill, SkillVersion } from '@prisma/client';

export interface PlanStep {
  skillId: string;
  skillVersionId: string; // REQUIRED - must pin concrete version
  inputs: Record<string, unknown>;
  description: string;
}

export interface Plan {
  steps: PlanStep[];
  estimatedSteps: number;
  reasoning?: string;
}

export interface PlanningEngine {
  plan(
    goal: string,
    context: Record<string, unknown>,
    availableSkills: Array<Skill & { versions: SkillVersion[] }>
  ): Promise<Plan>;
}

/**
 * MVP Planning Stub
 * Returns hardcoded plans based on goal patterns
 */
export class StubPlanningEngine implements PlanningEngine {
  async plan(
    goal: string,
    context: Record<string, unknown>,
    availableSkills: Array<Skill & { versions: SkillVersion[] }>
  ): Promise<Plan> {
    // For MVP, return a simple plan with first available skill
    // In production, this would use LLM to generate a plan
    
    if (availableSkills.length === 0) {
      throw new Error('No available skills for planning');
    }

    // Find first PUBLISHED skill with PUBLISHED version
    const skill = availableSkills.find((s) => {
      return s.status === 'PUBLISHED' && 
             s.visibility === 'ORG' &&
             s.versions.some((v) => v.status === 'PUBLISHED');
    });

    if (!skill) {
      throw new Error('No published skills available');
    }

    const publishedVersion = skill.versions.find((v) => v.status === 'PUBLISHED');
    if (!publishedVersion) {
      throw new Error('No published version found');
    }

    // Return simple single-step plan
    return {
      steps: [
        {
          skillId: skill.id,
          skillVersionId: publishedVersion.id, // Pin concrete version
          inputs: context, // Pass context as inputs
          description: `Execute ${skill.name} to accomplish: ${goal}`,
        },
      ],
      estimatedSteps: 1,
      reasoning: 'MVP stub: Single-step plan using first available skill',
    };
  }
}

export const planningEngine: PlanningEngine = new StubPlanningEngine();
