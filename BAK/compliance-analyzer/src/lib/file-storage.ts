/**
 * File Storage Utility
 * 
 * Handles file storage on local filesystem (can be upgraded to cloud storage)
 */

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'compliance-analyzer');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Supported MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain', // .txt
  'application/rtf', // .rtf
  'text/rtf', // .rtf (alternative)
];

// Ensure upload directory exists
export async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating upload directory:', error);
    throw error;
  }
}

/**
 * Validate file type
 */
export function isValidFileType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Save uploaded file
 */
export async function saveFile(
  file: File,
  userId: string
): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
  await ensureUploadDir();

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  if (!isValidFileType(file.type)) {
    throw new Error(`File type ${file.type} is not supported. Supported types: PDF, DOCX, DOC, TXT, RTF`);
  }

  // Generate unique filename
  const ext = path.extname(file.name) || getExtensionFromMimeType(file.type);
  const uniqueName = `${randomBytes(16).toString('hex')}${ext}`;
  const userDir = path.join(UPLOAD_DIR, userId);

  await fs.mkdir(userDir, { recursive: true });

  const filePath = path.join(userDir, uniqueName);

  // Save file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await fs.writeFile(filePath, buffer);

  return {
    filePath: path.relative(process.cwd(), filePath),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
}

/**
 * Get file path for download
 */
export function getFilePath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

/**
 * Delete file
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const filePath = getFilePath(relativePath);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // File might not exist, ignore error
    console.warn('Error deleting file:', error);
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt',
    'application/rtf': '.rtf',
    'text/rtf': '.rtf',
  };
  return mimeToExt[mimeType] || '';
}

export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
