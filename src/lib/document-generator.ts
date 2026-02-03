/**
 * Document Generator Utility
 * Generates Word documents from text content
 * 
 * SERVER-ONLY: This module uses Node.js APIs and cannot run in the browser.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

export interface DocumentOptions {
  title?: string;
  author?: string;
  subject?: string;
  description?: string;
}

/**
 * Parse inline formatting (bold, italic, code) from markdown
 * Handles **bold**, *italic*, and `code` formatting
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  
  // Simple approach: process in order, handling overlaps
  // Process bold (**text**) first, then italic (*text*), then code (`text`)
  let processed = text;
  const parts: Array<{ text: string; bold?: boolean; italics?: boolean; font?: { name: string } }> = [];
  
  // Process code blocks first (they don't overlap with bold/italic)
  processed = processed.replace(/`([^`]+)`/g, (match, content) => {
    parts.push({ text: content, font: { name: 'Courier New' }, bold: true });
    return `\0CODE${parts.length - 1}\0`;
  });
  
  // Process bold (**text**) - must come before italic to avoid conflicts
  processed = processed.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
    // Check if this contains any placeholders
    if (content.includes('\0')) {
      // Contains code blocks - handle separately
      return match;
    }
    parts.push({ text: content, bold: true });
    return `\0BOLD${parts.length - 1}\0`;
  });
  
  // Process italic (*text*) - but not if it's part of **
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (match, content) => {
    if (content.includes('\0')) {
      return match;
    }
    parts.push({ text: content, italics: true });
    return `\0ITALIC${parts.length - 1}\0`;
  });
  
  // Split by placeholders and build runs
  const segments = processed.split(/(\0\w+\d+\0)/);
  
  for (const segment of segments) {
    if (!segment) continue;
    
    const placeholderMatch = segment.match(/\0(\w+)(\d+)\0/);
    if (placeholderMatch) {
      const [, type, index] = placeholderMatch;
      const part = parts[parseInt(index)];
      if (part) {
        runs.push(new TextRun(part));
      }
    } else {
      // Regular text
      if (segment.trim()) {
        runs.push(new TextRun({ text: segment }));
      }
    }
  }
  
  // If no formatting found, return single run
  if (runs.length === 0) {
    return [new TextRun({ text })];
  }
  
  return runs;
}

/**
 * Parse markdown table
 */
function parseMarkdownTable(lines: string[], startIndex: number): { table: Table; consumedLines: number } | null {
  if (startIndex >= lines.length) return null;
  
  const firstLine = lines[startIndex].trim();
  if (!firstLine.startsWith('|') || !firstLine.endsWith('|')) {
    return null;
  }
  
  // Parse header row
  const headers = firstLine
    .split('|')
    .map(c => c.trim())
    .filter(c => c.length > 0);
  
  if (headers.length === 0) return null;
  
  // Check for separator row (|---|---|)
  if (startIndex + 1 >= lines.length) return null;
  const separatorLine = lines[startIndex + 1].trim();
  if (!separatorLine.match(/^\|[\s\-:]+\|/)) {
    return null; // Not a valid table
  }
  
  // Parse data rows
  const rows: string[][] = [];
  let lineIndex = startIndex + 2;
  
  while (lineIndex < lines.length) {
    const line = lines[lineIndex].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) {
      break; // End of table
    }
    
    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    if (cells.length === headers.length) {
      rows.push(cells);
    }
    lineIndex++;
  }
  
  // Create table
  const tableRows: TableRow[] = [];
  
  // Header row
  tableRows.push(
    new TableRow({
      children: headers.map(header =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: header, bold: true })],
            }),
          ],
          shading: {
            fill: 'E7E6E6',
          },
        })
      ),
    })
  );
  
  // Data rows
  rows.forEach(row => {
    tableRows.push(
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInlineFormatting(cell),
              }),
            ],
          })
        ),
      })
    );
  });
  
  const table = new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
  });
  
  return {
    table,
    consumedLines: lineIndex - startIndex,
  };
}

/**
 * Convert markdown-style content to Word document structure
 * Supports headings, lists, tables, and inline formatting
 */
function parseMarkdownToElements(content: string): Array<Paragraph | Table> {
  const lines = content.split('\n');
  const elements: Array<Paragraph | Table> = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) {
      // Empty line - add spacing
      elements.push(
        new Paragraph({
          children: [],
          spacing: { after: 200 },
        })
      );
      i++;
      continue;
    }
    
    // Check for markdown table
    const tableResult = parseMarkdownTable(lines, i);
    if (tableResult) {
      elements.push(tableResult.table);
      // Add spacing after table
      elements.push(
        new Paragraph({
          children: [],
          spacing: { after: 300 },
        })
      );
      i += tableResult.consumedLines;
      continue;
    }
    
    // Check for headings
    if (trimmed.startsWith('# ')) {
      // H1 - Title
      const text = trimmed.substring(2);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.LEFT,
          spacing: { after: 400 },
        })
      );
    } else if (trimmed.startsWith('## ')) {
      // H2 - Heading 1
      const text = trimmed.substring(3);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text).map(run => {
            if (run instanceof TextRun) {
              return new TextRun({ ...run, bold: true, size: 24 });
            }
            return run;
          }),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
    } else if (trimmed.startsWith('### ')) {
      // H3 - Heading 2
      const text = trimmed.substring(4);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text).map(run => {
            if (run instanceof TextRun) {
              return new TextRun({ ...run, bold: true, size: 22 });
            }
            return run;
          }),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 200 },
        })
      );
    } else if (trimmed.startsWith('#### ')) {
      // H4 - Heading 3
      const text = trimmed.substring(5);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text).map(run => {
            if (run instanceof TextRun) {
              return new TextRun({ ...run, bold: true, size: 20 });
            }
            return run;
          }),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 150 },
        })
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Bullet point
      const text = trimmed.substring(2);
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: '• ', bold: true }),
            ...parseInlineFormatting(text),
          ],
          spacing: { after: 150 },
          indent: { left: 400 },
        })
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      // Numbered list
      const match = trimmed.match(/^(\d+)\.\s(.+)$/);
      if (match) {
        const [, num, text] = match;
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${num}. `, bold: true }),
              ...parseInlineFormatting(text),
            ],
            spacing: { after: 150 },
            indent: { left: 400 },
          })
        );
      }
    } else if (trimmed.startsWith('> ')) {
      // Blockquote
      const text = trimmed.substring(2);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text).map(run => {
            if (run instanceof TextRun) {
              return new TextRun({ ...run, italics: true, color: '666666' });
            }
            return run;
          }),
          spacing: { after: 200 },
          indent: { left: 600, right: 600 },
          border: {
            left: {
              color: 'CCCCCC',
              size: 4,
              style: BorderStyle.SINGLE,
            },
          },
        })
      );
    } else {
      // Regular paragraph with inline formatting support
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(trimmed),
          spacing: { after: 200 },
        })
      );
    }
    
    i++;
  }
  
  return elements;
}

/**
 * Generate a Word document from text content
 * 
 * @param content - Text or markdown content to convert to Word document
 * @param options - Optional document metadata
 * @returns Buffer containing the Word document (.docx file)
 * 
 * @example
 * ```typescript
 * const buffer = await generateWordDocument(
 *   '# Report Title\n\n## Section 1\n\nContent here...',
 *   { title: 'My Report', author: 'System' }
 * );
 * ```
 */
export async function generateWordDocument(
  content: string,
  options: DocumentOptions = {}
): Promise<Buffer> {
  if (!content || content.trim().length === 0) {
    throw new Error('Content cannot be empty');
  }

  // Parse content into elements (paragraphs and tables)
  const elements = parseMarkdownToElements(content);

  // If no title provided, try to extract from first H1
  let documentTitle = options.title || 'Document';
  if (elements.length > 0 && elements[0] instanceof Paragraph) {
    const firstPara = elements[0] as Paragraph;
    if (firstPara.heading === HeadingLevel.TITLE && firstPara.children.length > 0) {
      const titleText = firstPara.children[0];
      if (titleText instanceof TextRun) {
        documentTitle = titleText.text;
      }
    }
  }

  // Create document with improved styling
  const doc = new Document({
    creator: options.author || 'Skills Library',
    title: documentTitle,
    description: options.description || options.subject || '',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt in half-points
            color: '000000',
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
            },
          },
        },
        heading1: {
          run: {
            font: 'Calibri',
            size: 32,
            bold: true,
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120,
            },
          },
        },
        heading2: {
          run: {
            font: 'Calibri',
            size: 28,
            bold: true,
            color: '2E74B5',
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 100,
            },
          },
        },
        heading3: {
          run: {
            font: 'Calibri',
            size: 24,
            bold: true,
            color: '1F4E78',
          },
          paragraph: {
            spacing: {
              before: 160,
              after: 80,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch in twips (20 * 72)
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: elements,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
