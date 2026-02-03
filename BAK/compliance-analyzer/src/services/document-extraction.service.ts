import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { getFilePath } from '@/lib/file-storage';
import mimeTypes from 'mime-types';

/**
 * Document Extraction Service
 * Extracts text from various document formats
 */
class DocumentExtractionService {
  /**
   * Extract text from a document file
   */
  async extractText(filePath: string, mimeType: string): Promise<string> {
    const fullPath = getFilePath(filePath);
    const buffer = await fs.readFile(fullPath);

    // Determine extraction method based on MIME type
    if (mimeType === 'application/pdf') {
      return this.extractFromPDF(buffer);
    } else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return this.extractFromDOCX(buffer);
    } else if (mimeType === 'text/plain' || mimeType === 'text/rtf') {
      return this.extractFromText(buffer, mimeType);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  /**
   * Extract text from DOCX
   */
  private async extractFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      throw new Error(`Failed to extract text from DOCX: ${error}`);
    }
  }

  /**
   * Extract text from plain text or RTF
   */
  private async extractFromText(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === 'text/rtf' || mimeType === 'application/rtf') {
        // RTF files - basic extraction (remove RTF control codes)
        const text = buffer.toString('utf-8');
        // Remove RTF control codes (basic approach)
        return text
          .replace(/\\[a-z]+\d*\s?/gi, '')
          .replace(/\{[^}]*\}/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        // Plain text
        return buffer.toString('utf-8');
      }
    } catch (error) {
      throw new Error(`Failed to extract text: ${error}`);
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(fileName: string): string {
    const mimeType = mimeTypes.lookup(fileName);
    return mimeType || 'application/octet-stream';
  }

  /**
   * Validate if file type is supported for extraction
   */
  isSupportedType(mimeType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/rtf',
      'application/rtf',
    ];
    return supportedTypes.includes(mimeType);
  }
}

export const documentExtractionService = new DocumentExtractionService();
