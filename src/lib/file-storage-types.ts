/**
 * File Storage Types
 * Type definitions for file storage (no Node.js dependencies)
 * This file can be safely imported in client code
 */

/**
 * File metadata for LLM attachments
 */
export interface FileMetadata {
  path: string;
  mimeType: string;
  name: string;
  isImage: boolean;
  isText: boolean;
}

/**
 * File attachment for LLM APIs
 */
export interface FileAttachment {
  ref: string; // File reference (__file__:path)
  metadata: FileMetadata;
}
