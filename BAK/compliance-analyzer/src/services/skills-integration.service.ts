import { skillsApiClient } from '@/lib/skills-api-client';
import { NextRequest } from 'next/server';

/**
 * Skills Integration Service
 * Handles integration with skills-library application
 */
class SkillsIntegrationService {
  /**
   * Get skill content for compliance analysis
   */
  async getSkillContent(
    skillId: string,
    userId: string,
    request?: NextRequest
  ): Promise<{ content: string; skillName: string }> {
    const response = await skillsApiClient.getPublishedSkillContent(
      skillId,
      userId,
      request
    );

    if (!response.success || !response.content) {
      throw new Error(
        response.error || 'Failed to fetch skill content from skills-library'
      );
    }

    // Get skill name for display
    const skillResponse = await skillsApiClient.getSkill(skillId, userId, request);
    const skillName =
      skillResponse.success && skillResponse.data
        ? skillResponse.data.name
        : 'Unknown Skill';

    return {
      content: response.content,
      skillName,
    };
  }

  /**
   * List available skills for selection
   */
  async listAvailableSkills(userId: string, request?: NextRequest) {
    const response = await skillsApiClient.listSkills(userId, {
      status: 'PUBLISHED', // Only show published skills
      pageSize: 100,
    }, request);

    if (!response.success || !response.data) {
      throw new Error(
        response.error || 'Failed to fetch skills from skills-library'
      );
    }

    return response.data.skills;
  }

  /**
   * Validate skill exists and is accessible
   */
  async validateSkill(skillId: string, userId: string, request?: NextRequest): Promise<boolean> {
    const response = await skillsApiClient.getSkill(skillId, userId, request);
    return response.success && response.data !== undefined;
  }
}

export const skillsIntegrationService = new SkillsIntegrationService();
