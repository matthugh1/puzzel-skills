import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceDocumentRepository } from '@/repositories/compliance-document.repository';
import type { ApiResponse } from '@shared/types';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * GET /api/documents/[id] - Get document details
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

    const document = await complianceDocumentRepository.findById(
      params.id,
      userId
    );

    if (!document) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to fetch document',
      },
      { status: 500 }
    );
  }
}
