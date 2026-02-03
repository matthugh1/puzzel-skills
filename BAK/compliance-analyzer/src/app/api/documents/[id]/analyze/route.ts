import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceAnalysisService } from '@/services/compliance-analysis.service';
import type { ApiResponse } from '@shared/types';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * POST /api/documents/[id]/analyze - Analyze a document for compliance
 */
export async function POST(
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

    // Parse request body for provider selection
    const body = await request.json().catch(() => ({}));
    const provider = (body.provider as 'openai' | 'anthropic') || 'openai';

    // Run compliance analysis
    const result = await complianceAnalysisService.analyzeDocument(
      params.id,
      userId,
      provider
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error analyzing document:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to analyze document',
      },
      { status: 500 }
    );
  }
}
