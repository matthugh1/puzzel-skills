import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceAnalysisRepository } from '@/repositories/compliance-analysis.repository';
import type { ApiResponse } from '@shared/types';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * GET /api/documents/[id]/analysis - Get analysis results for a document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const analysis = await complianceAnalysisRepository.findByDocumentId(
      params.id,
      userId
    );

    if (!analysis) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to fetch analysis',
      },
      { status: 500 }
    );
  }
}
