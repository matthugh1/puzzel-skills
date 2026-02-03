import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { skillsIntegrationService } from '@/services/skills-integration.service';
import type { ApiResponse } from '@shared/types';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * GET /api/skills - Proxy to skills-library API to list available skills
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check application access
    const hasAccess = await checkApplicationAccess(userId, APPLICATION_SLUG);
    if (!hasAccess) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Application access denied' },
        { status: 403 }
      );
    }

    // Forward the user's session cookies to skills-library for authentication
    const skills = await skillsIntegrationService.listAvailableSkills(userId, request);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        skills,
      },
    });
  } catch (error: any) {
    console.error('Error fetching skills:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to fetch skills',
      },
      { status: 500 }
    );
  }
}
