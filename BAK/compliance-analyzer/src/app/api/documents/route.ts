import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceDocumentRepository } from '@/repositories/compliance-document.repository';
import type { ApiResponse } from '@shared/types';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * GET /api/documents - List user's documents
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const status = searchParams.get('status') as any;
    const skillId = searchParams.get('skillId') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await complianceDocumentRepository.findByUser(userId, {
      skip: (page - 1) * pageSize,
      take: pageSize,
      status,
      skillId,
      search,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error listing documents:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to list documents',
      },
      { status: 500 }
    );
  }
}
