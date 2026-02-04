/**
 * Temporary File Storage Utility
 * Manages temporary files for workflow runs - files are stored locally
 * and cleaned up after workflow completion.
 * 
 * SERVER-ONLY: This module uses Node.js fs APIs and cannot run in the browser.
 */

import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import type { FileMetadata } from './file-storage-types';

// Base directory for temporary files (uses OS temp directory)
const TEMP_BASE_DIR = process.env.TEMP_FILE_DIR || join(process.cwd(), '.tmp', 'workflow-files');

/**
 * Get the directory path for a specific run's files
 */
function getRunDir(runId: string): string {
  return join(TEMP_BASE_DIR, runId);
}

/**
 * File reference prefix used in initialContext
 */
export const FILE_REF_PREFIX = '__file__:';

/**
 * Check if a value is a file reference
 */
export function isFileReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(FILE_REF_PREFIX);
}

/**
 * Extract file path from a file reference
 */
export function getFilePathFromReference(ref: string): string {
  if (!isFileReference(ref)) {
    throw new Error(`Invalid file reference: ${ref}`);
  }
  return ref.substring(FILE_REF_PREFIX.length);
}

/**
 * Create a file reference string
 */
export function createFileReference(filePath: string): string {
  return `${FILE_REF_PREFIX}${filePath}`;
}

/**
 * Save a file for a workflow run
 * Returns the file reference to store in initialContext
 */
export async function saveFile(
  runId: string,
  fieldName: string,
  fileContent: Buffer | string,
  originalFileName?: string
): Promise<string> {
  const runDir = getRunDir(runId);
  
  // Ensure run directory exists
  if (!existsSync(runDir)) {
    await mkdir(runDir, { recursive: true });
  }

  // Generate safe filename (use original name if provided, otherwise use field name)
  const safeFileName = originalFileName 
    ? sanitizeFileName(originalFileName)
    : `${fieldName}-${Date.now()}`;
  
  const filePath = join(runDir, safeFileName);
  
  // Write file
  const content = typeof fileContent === 'string' 
    ? Buffer.from(fileContent, 'utf-8')
    : fileContent;
  
  await writeFile(filePath, content);
  
  console.error(`[FileStorage] saveFile: Saved file:`, {
    runId,
    safeFileName,
    filePath,
    fileExists: existsSync(filePath),
    fileSize: content.length,
  });
  
  // Return relative path from run directory (for portability)
  // Use forward slash for cross-platform compatibility
  const relativePath = `${runId}/${safeFileName}`;
  const fileRef = createFileReference(relativePath);
  
  console.error(`[FileStorage] saveFile: Created file reference:`, {
    relativePath,
    fileRef,
  });
  
  return fileRef;
}

/**
 * Detect MIME type from file buffer and extension
 * Magic bytes take precedence over filename extension
 */
export function detectMimeType(buffer: Buffer, fileName?: string): string {
  // Check magic bytes for common file types (content-based detection takes priority)
  const header = buffer.subarray(0, 12);
  const headerStart = buffer.subarray(0, 4);
  
  // PDF - check first 4 bytes for '%PDF' (must be ASCII)
  // PDF files always start with %PDF followed by version number
  if (buffer.length >= 4) {
    const pdfHeader = headerStart.toString('ascii');
    if (pdfHeader === '%PDF') {
      console.error(`[FileStorage] Detected PDF by magic bytes (filename: ${fileName}, header: ${pdfHeader})`);
      return 'application/pdf';
    }
    // Also check as UTF-8/latin1 in case
    const pdfHeaderUtf8 = headerStart.toString('utf-8');
    if (pdfHeaderUtf8 === '%PDF') {
      console.error(`[FileStorage] Detected PDF by magic bytes (UTF-8) (filename: ${fileName})`);
      return 'application/pdf';
    }
  }
  
  // Images
  if (header.subarray(0, 3).toString() === 'GIF') return 'image/gif';
  if (header.subarray(0, 2).toString('hex') === 'ffd8') return 'image/jpeg';
  if (header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  
  // Text files
  if (header.subarray(0, 4).toString() === '%!PS') return 'application/postscript';
  
  // Check for Office Open XML formats (ZIP-based, starts with PK)
  // .docx, .xlsx, .pptx are ZIP archives
  const zipHeader = headerStart.toString('hex');
  if (zipHeader.startsWith('504b')) {
    // It's a ZIP file - could be .docx, .xlsx, .pptx, or actual .zip
    // Check filename extension for Office formats
    if (fileName) {
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    // Default to ZIP if no Office extension
    return 'application/zip';
  }
  
  // Fallback to extension-based detection (only if magic bytes didn't match)
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeMap: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'csv': 'text/csv',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
    };
    if (ext && mimeMap[ext]) {
      console.error(`[FileStorage] Detected MIME type by extension: ${mimeMap[ext]} (filename: ${fileName})`);
      return mimeMap[ext];
    }
  }
  
  // Default fallback
  console.error(`[FileStorage] Using default MIME type (filename: ${fileName}, header: ${headerStart.toString('hex')})`);
  return 'application/octet-stream';
}

/**
 * Check if MIME type is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if MIME type is text-based
 */
export function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || 
         mimeType === 'application/json' ||
         mimeType === 'application/xml' ||
         mimeType === 'application/javascript' ||
         mimeType === 'application/typescript';
}

/**
 * Get file metadata from a file reference
 */
export async function getFileMetadata(ref: string): Promise<FileMetadata> {
  const filePath = getFilePathFromReference(ref);
  
  // Always resolve relative to TEMP_BASE_DIR (filePath is runId/filename)
  const fullPath = join(TEMP_BASE_DIR, filePath);
  
  console.error(`[FileStorage] getFileMetadata:`, {
    ref,
    filePath,
    fullPath,
    tempBaseDir: TEMP_BASE_DIR,
    exists: existsSync(fullPath),
  });
  
  if (!existsSync(fullPath)) {
    // List directory contents for debugging
    const runId = filePath.split('/')[0];
    const runDir = join(TEMP_BASE_DIR, runId);
    const dirExists = existsSync(runDir);
    let dirContents: string[] = [];
    if (dirExists) {
      try {
        const { readdirSync } = await import('fs');
        dirContents = readdirSync(runDir);
      } catch (e) {
        // Ignore readdir errors
      }
    }
    
    console.error(`[FileStorage] File not found. Debug info:`, {
      fullPath,
      runDir,
      runDirExists: dirExists,
      dirContents,
    });
    
    throw new Error(`File not found: ${fullPath}`);
  }
  
  const buffer = await readFile(fullPath);
  const fileName = filePath.split('/').pop() || 'file';
  
  // Log file info for debugging
  const firstBytes = buffer.subarray(0, 8).toString('hex');
  const firstBytesAscii = buffer.subarray(0, 8).toString('ascii');
  console.error(`[FileStorage] Detecting MIME type for: ${fileName}`);
  console.error(`[FileStorage] First 8 bytes (hex): ${firstBytes}`);
  console.error(`[FileStorage] First 8 bytes (ASCII): ${firstBytesAscii}`);
  
  const mimeType = detectMimeType(buffer, fileName);
  
  console.error(`[FileStorage] Detected MIME type: ${mimeType} for file: ${fileName}`);
  
  return {
    path: fullPath,
    mimeType,
    name: fileName,
    isImage: isImageMimeType(mimeType),
    isText: isTextMimeType(mimeType),
  };
}

/**
 * Load file as buffer (for base64 encoding)
 */
export async function loadFileBuffer(ref: string): Promise<Buffer> {
  const filePath = getFilePathFromReference(ref);
  
  // Always resolve relative to TEMP_BASE_DIR (filePath is runId/filename with forward slashes)
  const fullPath = join(TEMP_BASE_DIR, ...filePath.split('/'));
  
  console.error(`[FileStorage] loadFileBuffer:`, {
    ref,
    filePath,
    fullPath,
    tempBaseDir: TEMP_BASE_DIR,
    exists: existsSync(fullPath),
  });
  
  if (!existsSync(fullPath)) {
    // List directory contents for debugging
    const runId = filePath.split('/')[0];
    const runDir = join(TEMP_BASE_DIR, runId);
    const dirExists = existsSync(runDir);
    let dirContents: string[] = [];
    if (dirExists) {
      try {
        const { readdirSync } = await import('fs');
        dirContents = readdirSync(runDir);
      } catch (e) {
        // Ignore readdir errors
      }
    }
    
    console.error(`[FileStorage] File not found. Debug info:`, {
      fullPath,
      runDir,
      runDirExists: dirExists,
      dirContents,
    });
    
    throw new Error(`File not found: ${fullPath}`);
  }
  
  return await readFile(fullPath);
}

/**
 * Extract text from a PDF using pdf-parse v1.x
 * @param filePath Full path to the PDF file (optional, used to read buffer if buffer not provided)
 * @param buffer PDF file buffer (required if filePath not provided)
 * @returns Extracted text content
 * @throws Error if extraction fails or PDF contains no extractable text
 */
export async function extractPDFText(filePath?: string, buffer?: Buffer): Promise<string> {
  try {
    // Ensure we have a buffer
    if (!buffer && filePath && existsSync(filePath)) {
      buffer = await readFile(filePath);
    }
    
    if (!buffer) {
      throw new Error('PDF buffer is required for extraction');
    }
    
    console.error(`[FileStorage] Attempting PDF text extraction (size: ${buffer.length} bytes)`);
    
    // Use pdf-parse v1.x which works reliably with buffers
    // NOTE: pdf-parse has a known bug where it tries to access './test/data/05-versions-space.pdf'
    // during execution. We'll catch this specific error and work around it.
    try {
      // Import pdf-parse v1.x - use default import (works with v1.x)
      const pdfParse = require('pdf-parse');
      
      console.error(`[FileStorage] Using pdf-parse v1.x API with buffer (size: ${buffer.length} bytes)...`);
      
      // Ensure buffer is actually a Buffer instance
      const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      
      // Call pdfParse with buffer directly
      // pdf-parse should accept Buffer as first argument
      let pdfData;
      try {
        pdfData = await pdfParse(pdfBuffer);
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        
        // Handle known pdf-parse bug: tries to access test file './test/data/05-versions-space.pdf'
        // This is a bug in pdf-parse where it has debug code that runs during execution
        // The test file should exist at ./test/data/05-versions-space.pdf (copied from node_modules)
        if (errorMsg.includes('test/data') || errorMsg.includes('05-versions-space.pdf')) {
          console.error(`[FileStorage] pdf-parse test file error detected (known bug in pdf-parse library)`);
          console.error(`[FileStorage] This is a bug in pdf-parse - it tries to access a test file during execution`);
          console.error(`[FileStorage] Retrying parse (the error is from debug code, not the actual parsing)...`);
          
          // Retry the parse - the error is from debug code, not the actual parsing
          // The parse should succeed on retry if the test file exists
          try {
            pdfData = await pdfParse(pdfBuffer);
            console.error(`[FileStorage] Retry succeeded after test file error`);
          } catch (retryError) {
            const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
            
            // If retry also fails with the same test file error, the test file might be missing
            if (retryErrorMsg.includes('test/data') || retryErrorMsg.includes('05-versions-space.pdf')) {
              console.error(`[FileStorage] Test file error persists - checking if test file exists...`);
              const testFilePath = join(process.cwd(), 'test', 'data', '05-versions-space.pdf');
              if (!existsSync(testFilePath)) {
                console.error(`[FileStorage] Test file missing at ${testFilePath}`);
                console.error(`[FileStorage] Workaround: Copy node_modules/pdf-parse/test/data/05-versions-space.pdf to test/data/`);
              }
              
              // Try one more time - sometimes it works despite the error
              pdfData = await pdfParse(pdfBuffer);
            } else {
              // If it's a different error, throw that
              throw retryError;
            }
          }
        } else {
          // Re-throw if it's a different error
          throw parseError;
        }
      }
      
      console.error(`[FileStorage] pdf-parse completed. Pages: ${pdfData.numpages || 'unknown'}, Text length: ${pdfData.text?.length || 0}`);
      
      const extractedText = pdfData.text || '';
      
      if (!extractedText || extractedText.trim().length === 0) {
        console.error(`[FileStorage] PDF extraction returned empty text. PDF info:`, pdfData.info);
        throw new Error(`PDF text extraction returned empty result - PDF may contain only images/scans (no extractable text) or be corrupted. PDF has ${pdfData.numpages || 0} page(s).`);
      }
      
      console.error(`[FileStorage] Successfully extracted ${extractedText.length} characters from PDF (${pdfData.numpages || 0} pages)`);
      return extractedText;
    } catch (pdfError) {
      // Re-throw with context
      const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
      const errorStack = pdfError instanceof Error ? pdfError.stack : undefined;
      
      console.error(`[FileStorage] pdf-parse error details:`, {
        error: errorMsg,
        stack: errorStack,
        bufferSize: buffer.length,
        filePath,
      });
      
      // Check if it's the test file error - this suggests a bug in pdf-parse
      if (errorMsg.includes('test/data') || errorMsg.includes('05-versions-space.pdf')) {
        throw new Error(`PDF extraction failed due to internal library issue. The PDF file appears to be valid (${buffer.length} bytes), but pdf-parse encountered an error. Please try a different PDF file or contact support.`);
      }
      
      throw new Error(`Failed to extract text from PDF: ${errorMsg}`);
    }
  } catch (pdfError) {
    const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
    console.error(`[FileStorage] Error extracting text from PDF:`, pdfError);
    if (buffer) {
      console.error(`[FileStorage] PDF buffer size: ${buffer.length} bytes`);
      console.error(`[FileStorage] PDF first 20 bytes: ${buffer.subarray(0, 20).toString('hex')}`);
    }
    if (filePath) {
      console.error(`[FileStorage] PDF file path: ${filePath}`);
    }
    
    // Provide more specific error messages
    if (errorMsg.includes('encrypted') || errorMsg.includes('password')) {
      throw new Error(`PDF is encrypted and requires a password. ${errorMsg}`);
    }
    if (errorMsg.includes('corrupted') || errorMsg.includes('invalid')) {
      throw new Error(`PDF file appears to be corrupted or invalid. ${errorMsg}`);
    }
    
    throw new Error(`Failed to extract text from PDF: ${errorMsg}`);
  }
}

/**
 * Load file content from a file reference
 * Automatically extracts text from PDFs
 * @deprecated Use getFileMetadata and loadFileBuffer for native file attachments
 */
export async function loadFile(ref: string): Promise<string> {
  const filePath = getFilePathFromReference(ref);
  
  // Always resolve relative to TEMP_BASE_DIR (filePath is runId/filename with forward slashes)
  // Use the same approach as loadFileBuffer for consistency
  const fullPath = join(TEMP_BASE_DIR, ...filePath.split('/'));
  
  console.error(`[FileStorage] loadFile:`, {
    ref,
    filePath,
    fullPath,
    tempBaseDir: TEMP_BASE_DIR,
    exists: existsSync(fullPath),
  });
  
  if (!existsSync(fullPath)) {
    // List directory contents for debugging
    const runId = filePath.split('/')[0];
    const runDir = join(TEMP_BASE_DIR, runId);
    const dirExists = existsSync(runDir);
    let dirContents: string[] = [];
    if (dirExists) {
      try {
        const { readdirSync } = await import('fs');
        dirContents = readdirSync(runDir);
      } catch (e) {
        // Ignore readdir errors
      }
    }
    
    console.error(`[FileStorage] File not found. Debug info:`, {
      fullPath,
      runDir,
      runDirExists: dirExists,
      dirContents,
    });
    
    throw new Error(`File not found: ${fullPath}`);
  }
  
  // Read file buffer
  const buffer = await readFile(fullPath);
  
  // Check if it's a PDF by reading first few bytes
  const isPDF = buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF';
  
  if (isPDF) {
    try {
      console.error(`[FileStorage] Detected PDF file: ${fullPath} (size: ${buffer.length} bytes)`);
      // Pass file path to extractPDFText for better compatibility with pdf-parse v2.x
      return await extractPDFText(fullPath, buffer);
    } catch (pdfError) {
      const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
      console.error(`[FileStorage] Error extracting text from PDF ${fullPath}:`, pdfError);
      throw pdfError; // Re-throw to preserve error context
    }
  }
  
  // For non-PDF files, read as text
  // Try UTF-8 first, fallback to latin1 if UTF-8 fails
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    // If UTF-8 fails, try latin1 (handles some binary files better)
    return buffer.toString('latin1');
  }
}

/**
 * Clean up all files for a workflow run
 * Skips files that are referenced in step outputs (to allow downloads)
 */
export async function cleanupRunFiles(runId: string): Promise<void> {
  const runDir = getRunDir(runId);
  
  if (!existsSync(runDir)) {
    return; // Nothing to clean up
  }

  try {
    // Check if any files are referenced in run step outputs
    const { db } = await import('@/lib/db');
    const steps = await db.runStep.findMany({
      where: { runId },
      select: { outputContext: true },
    });

    // Collect all file references from outputs
    const referencedFiles = new Set<string>();
    const findFileRefs = (obj: unknown): void => {
      if (typeof obj === 'string' && isFileReference(obj)) {
        const filePath = getFilePathFromReference(obj);
        referencedFiles.add(filePath);
      } else if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(findFileRefs);
        } else {
          Object.values(obj).forEach(findFileRefs);
        }
      }
    };

    steps.forEach(step => {
      if (step.outputContext) {
        findFileRefs(step.outputContext);
      }
    });

    if (referencedFiles.size > 0) {
      console.log(`[FileStorage] Skipping cleanup for run ${runId} - ${referencedFiles.size} file(s) referenced in outputs:`, Array.from(referencedFiles));
      return; // Don't delete files that are referenced in outputs
    }

    // No files referenced - safe to clean up
    await rm(runDir, { recursive: true, force: true });
    console.log(`[FileStorage] Cleaned up files for run ${runId}`);
  } catch (error) {
    console.error(`[FileStorage] Error cleaning up files for run ${runId}:`, error);
    // Don't throw - cleanup failures shouldn't break workflow completion
  }
}

/**
 * Sanitize filename to prevent directory traversal and invalid characters
 */
function sanitizeFileName(fileName: string): string {
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[\/\\]/g, '-') // Replace slashes
    .replace(/[<>:"|?*]/g, '-') // Replace invalid chars
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Initialize temp directory on startup
 */
export async function initializeFileStorage(): Promise<void> {
  if (!existsSync(TEMP_BASE_DIR)) {
    await mkdir(TEMP_BASE_DIR, { recursive: true });
    console.log(`[FileStorage] Initialized temp directory: ${TEMP_BASE_DIR}`);
  }
}
