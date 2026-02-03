import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceDocumentRepository } from '@/repositories/compliance-document.repository';
import { complianceAnalysisRepository } from '@/repositories/compliance-analysis.repository';
import { generateComplianceReport } from '@/lib/document-generator';
import type { AnalysisData } from '@/lib/document-generator';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * POST /api/export - Export compliance analysis as Word document
 * 
 * Body: {
 *   documentId: string (required) - ID of the document to export
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check application access
    const hasAccess = await checkApplicationAccess(userId, APPLICATION_SLUG);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Application access denied' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Fetch document and analysis
    const document = await complianceDocumentRepository.findById(
      documentId,
      userId
    );

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    const analysis = await complianceAnalysisRepository.findByDocumentId(
      documentId,
      userId
    );

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Analysis not found for this document' },
        { status: 404 }
      );
    }

    // Prepare analysis data
    const analysisData: AnalysisData = {
      score: analysis.score,
      status: analysis.status as 'PASS' | 'FAIL' | 'PARTIAL',
      findings: (analysis.findings as any) || [],
      violations: (analysis.violations as any) || [],
      recommendations: (analysis.recommendations as any) || [],
    };

    // Prepare metadata
    const metadata = {
      fileName: document.fileName,
      dateAnalyzed: analysis.completedAt || analysis.createdAt,
    };

    // Generate Word document
    const docBuffer = await generateComplianceReport(analysisData, metadata);

    // Generate filename
    const sanitizedFileName = document.fileName
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-z0-9]/gi, '_') // Replace special chars with underscore
      .toLowerCase();
    const exportFileName = `${sanitizedFileName}_analysis_report.docx`;

    // Return the document as a downloadable file
    // Convert Buffer to ArrayBuffer for NextResponse
    const arrayBuffer = docBuffer.buffer.slice(
      docBuffer.byteOffset,
      docBuffer.byteOffset + docBuffer.byteLength
    );
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${exportFileName}"`,
        'Content-Length': docBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error exporting document:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to export document',
      },
      { status: 500 }
    );
  }
}
