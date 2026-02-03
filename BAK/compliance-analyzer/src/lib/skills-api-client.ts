/**
 * Skills API Client
 * HTTP client for communicating with skills-library application
 */

import { generateToken } from '@shared/auth';
import { NextRequest } from 'next/server';

const SKILLS_LIBRARY_BASE_URL =
  process.env.SKILLS_LIBRARY_URL || 'http://localhost:3006';

export interface Skill {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  status: string;
  versions?: Array<{
    id: string;
    versionNumber: number;
    content: string;
    status: string;
    publishedAt?: string | null;
  }>;
}

export interface SkillsListResponse {
  success: boolean;
  data?: {
    skills: Skill[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface SkillResponse {
  success: boolean;
  data?: Skill;
  error?: string;
}

/**
 * Skills API Client
 */
class SkillsApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = SKILLS_LIBRARY_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate JWT token for cross-app authentication
   */
  private async generateAuthToken(userId: string, request?: NextRequest): Promise<string> {
    // Try to get email from NextAuth token
    let userEmail = '';
    if (request) {
      try {
        const { getToken } = await import('next-auth/jwt');
        const token = await getToken({ 
          req: request,
          secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
        });
        userEmail = (token?.email as string) || '';
      } catch (error) {
        // If we can't get email from token, try database
        try {
          const { getUserById } = await import('@shared/database');
          const user = await getUserById(userId);
          userEmail = user?.email || '';
        } catch (dbError) {
          // Fallback to empty email
        }
      }
    } else {
      // If no request, try to get email from database
      try {
        const { getUserById } = await import('@shared/database');
        const user = await getUserById(userId);
        userEmail = user?.email || '';
      } catch (dbError) {
        // Fallback to empty email
      }
    }

    return generateToken({
      userId,
      email: userEmail,
    });
  }

  /**
   * List available skills
   */
  async listSkills(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: string;
      category?: string;
      search?: string;
    } = {},
    request?: NextRequest
  ): Promise<SkillsListResponse> {
    const { page = 1, pageSize = 100, status, category, search } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (status) {
      params.append('status', status);
    }
    if (category) {
      params.append('category', category);
    }
    if (search) {
      params.append('search', search);
    }

    // Generate JWT token for cross-app authentication
    const jwtToken = await this.generateAuthToken(userId, request);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      'x-user-id': userId,
    };

    try {
      const url = `${this.baseUrl}/api/skills?${params.toString()}`;
      console.log('[SkillsApiClient] Fetching skills from:', url);
      console.log('[SkillsApiClient] Has Bearer token:', !!jwtToken);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('[SkillsApiClient] Response status:', response.status, response.statusText);
      console.log('[SkillsApiClient] Response headers:', Object.fromEntries(response.headers.entries()));
      
      const contentType = response.headers.get('content-type') || '';
      console.log('[SkillsApiClient] Content-Type:', contentType);

      // Check if response is HTML instead of JSON (indicates redirect or error page)
      if (!contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('[SkillsApiClient] Non-JSON response received:', responseText.substring(0, 1000));
        
        return {
          success: false,
          error: `Expected JSON but received ${contentType}. Response: ${responseText.substring(0, 200)}`,
        };
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[SkillsApiClient] Error response:', responseText.substring(0, 500));
        
        let error;
        try {
          error = JSON.parse(responseText);
        } catch {
          error = { error: `HTTP ${response.status}: ${responseText.substring(0, 200)}` };
        }
        
        return {
          success: false,
          error: error.error || `HTTP ${response.status}`,
        };
      }

      const jsonData = await response.json();
      console.log('[SkillsApiClient] Successfully fetched skills, count:', jsonData?.data?.skills?.length || 0);
      return jsonData;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch skills',
      };
    }
  }

  /**
   * Get skill by ID
   */
  async getSkill(skillId: string, userId: string, request?: NextRequest): Promise<SkillResponse> {
    // Generate JWT token for cross-app authentication
    const jwtToken = await this.generateAuthToken(userId, request);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      'x-user-id': userId,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/skills/${skillId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Failed to fetch skill',
        }));
        return {
          success: false,
          error: error.error || `HTTP ${response.status}`,
        };
      }

      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch skill',
      };
    }
  }

  /**
   * Get published version content of a skill
   */
  async getPublishedSkillContent(
    skillId: string,
    userId: string,
    request?: NextRequest
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const skillResponse = await this.getSkill(skillId, userId, request);

    if (!skillResponse.success || !skillResponse.data) {
      return {
        success: false,
        error: skillResponse.error || 'Skill not found',
      };
    }

    const skill = skillResponse.data;

    // Find published version
    const publishedVersion = skill.versions?.find(
      (v) => v.status === 'PUBLISHED'
    );

    if (!publishedVersion) {
      return {
        success: false,
        error: 'No published version found for this skill',
      };
    }

    return {
      success: true,
      content: publishedVersion.content,
    };
  }
}

export const skillsApiClient = new SkillsApiClient();
