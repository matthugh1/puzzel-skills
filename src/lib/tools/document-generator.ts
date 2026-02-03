/**
 * Document Generator Tool
 * Reusable tool for generating Word documents from text content
 */

import type { Tool } from './types';
import { generateWordDocument } from '@/lib/document-generator';
import { saveFile } from '@/lib/file-storage';

export const documentGeneratorTool: Tool = {
  id: 'document-generator',
  name: 'Word Document Generator',
  description: 'Converts text content into a Word document (.docx)',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'Text or markdown content to convert to Word document',
        required: true,
      },
      title: {
        type: 'string',
        description: 'Document title (optional)',
        required: false,
      },
      fileName: {
        type: 'string',
        description: 'Output filename (optional, defaults to generated name)',
        required: false,
      },
      author: {
        type: 'string',
        description: 'Document author (optional)',
        required: false,
      },
      description: {
        type: 'string',
        description: 'Document description (optional)',
        required: false,
      },
    },
    required: ['content'],
  },
  executor: async (args, context) => {
    const { content, title, fileName, author, description } = args;

    console.error('[DocumentGenerator] Tool execution started:', {
      hasContent: !!content,
      contentLength: content?.length,
      context,
      runId: context.runId,
    });

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        success: false,
        output: '',
        error: 'Content is required and must be a non-empty string',
      };
    }

    if (!context.runId) {
      console.error('[DocumentGenerator] ERROR: runId missing from context:', context);
      return {
        success: false,
        output: '',
        error: 'runId is required in context for document generation',
      };
    }

    try {
      // Generate Word document
      const docBuffer = await generateWordDocument(content, {
        title: typeof title === 'string' ? title : undefined,
        author: typeof author === 'string' ? author : undefined,
        description: typeof description === 'string' ? description : undefined,
      });

      // Generate filename if not provided
      const outputFileName = typeof fileName === 'string' && fileName.trim()
        ? fileName.trim()
        : `document_${Date.now()}.docx`;

      // Save file
      console.error('[DocumentGenerator] Saving file:', {
        runId: context.runId,
        outputFileName,
        bufferSize: docBuffer.length,
      });
      
      const fileRef = await saveFile(
        context.runId,
        'document',
        docBuffer,
        outputFileName.endsWith('.docx') ? outputFileName : `${outputFileName}.docx`
      );

      console.error('[DocumentGenerator] File saved successfully:', {
        fileRef,
        outputFileName,
      });

      return {
        success: true,
        output: fileRef, // Return file reference
        metadata: {
          fileName: outputFileName,
          fileRef,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentLength: content.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
