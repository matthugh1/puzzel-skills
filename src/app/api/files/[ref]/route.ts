/**
 * File Download API
 * Downloads files by file reference
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { isFileReference, loadFileBuffer, getFileMetadata } from '@/lib/file-storage';

interface RouteContext {
  params: Promise<{ ref: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Check authentication
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { ref } = params;
    
    console.log('[API Files] Raw params:', params);
    console.log('[API Files] Raw ref from params:', ref);
    
    if (!ref) {
      console.error('[API Files] No ref parameter provided');
      return NextResponse.json(
        { error: 'File reference is required' },
        { status: 400 }
      );
    }
    
    // Decode the file reference (URL encoded)
    // Next.js may have already decoded it, but we'll decode again to be safe
    let decodedRef: string;
    try {
      decodedRef = decodeURIComponent(ref);
    } catch (e) {
      // If decoding fails, use the original ref (might already be decoded)
      decodedRef = ref;
    }
    
    console.log('[API Files] Download request:', {
      rawRef: ref,
      encodedRef: ref,
      decodedRef,
      isFileReference: isFileReference(decodedRef),
      refType: typeof ref,
    });
    
    // Validate file reference format
    if (!isFileReference(decodedRef)) {
      console.error('[API Files] Invalid file reference format:', decodedRef);
      return NextResponse.json(
        { error: 'Invalid file reference format', received: decodedRef },
        { status: 400 }
      );
    }

    // Get file metadata
    let metadata;
    try {
      metadata = await getFileMetadata(decodedRef);
      console.log('[API Files] File metadata retrieved:', {
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: metadata.size,
      });
    } catch (error) {
      console.error('[API Files] Error getting file metadata:', error);
      throw error;
    }
    
    // Load file buffer
    let buffer;
    try {
      buffer = await loadFileBuffer(decodedRef);
      console.log('[API Files] File buffer loaded:', {
        size: buffer.length,
      });
    } catch (error) {
      console.error('[API Files] Error loading file buffer:', error);
      throw error;
    }

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': metadata.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(metadata.name)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[API Files] Error downloading file:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to download file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
