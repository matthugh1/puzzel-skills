import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { saveFile, isValidFileType, MAX_FILE_SIZE } from '@/lib/file-storage';
import { complianceDocumentRepository } from '@/repositories/compliance-document.repository';
import type { ApiResponse } from '@shared/types';
import { z } from 'zod';

const APPLICATION_SLUG = 'compliance-analyzer';

const uploadDocumentSchema = z.object({
  skillId: z.string().min(1, 'Skill ID is required'),
  skillName: z.string().min(1, 'Skill name is required'),
});

/**
 * POST /api/documents/upload - Upload document(s) for compliance analysis
 */
export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const skillId = formData.get('skillId') as string;
    const skillName = formData.get('skillName') as string;

    // Validate input
    const validated = uploadDocumentSchema.parse({ skillId, skillName });

    if (!files || files.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate and save each file
    const documents = [];
    const errors = [];

    for (const file of files) {
      try {
        // Validate file type
        if (!isValidFileType(file.type)) {
          errors.push({
            fileName: file.name,
            error: `File type ${file.type} is not supported`,
          });
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push({
            fileName: file.name,
            error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          });
          continue;
        }

        // Save file
        const fileInfo = await saveFile(file, userId);

        // Create document record
        const document = await complianceDocumentRepository.create({
          userId,
          fileName: fileInfo.fileName,
          filePath: fileInfo.filePath,
          fileSize: fileInfo.fileSize,
          mimeType: fileInfo.mimeType,
          skillId: validated.skillId,
          skillName: validated.skillName,
          status: 'PENDING',
        });

        documents.push(document);
      } catch (error: any) {
        errors.push({
          fileName: file.name,
          error: error.message || 'Failed to upload file',
        });
      }
    }

    if (documents.length === 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Failed to upload any files',
          details: errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        documents,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Error uploading documents:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message || 'Failed to upload documents',
      },
      { status: 500 }
    );
  }
}
