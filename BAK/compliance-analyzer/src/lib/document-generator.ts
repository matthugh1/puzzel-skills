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
  ShadingType,
  Footer,
  PageNumber,
  Header,
  SectionType,
} from 'docx';

export interface AnalysisData {
  score: number;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  findings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    category?: string;
    description: string;
    location?: string;
  }>;
  violations: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    rule: string;
    description: string;
    location?: string;
  }>;
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    description: string;
  }>;
}

export interface DocumentMetadata {
  fileName: string;
  dateAnalyzed: Date;
}

/**
 * Risk level color mapping for Word document highlighting
 * Using pastel colors for a softer, more professional appearance
 */
const RISK_COLORS = {
  CRITICAL: { fill: 'FEE2E2', text: '991B1B' }, // Pastel Red - light red background with dark red text
  HIGH: { fill: 'FED7AA', text: '9A3412' },     // Pastel Orange - light orange background with dark orange text
  MEDIUM: { fill: 'FEF3C7', text: '92400E' },   // Pastel Amber - light yellow background with dark amber text
  LOW: { fill: 'D1FAE5', text: '065F46' },      // Pastel Green - light green background with dark green text
  INFO: { fill: 'DBEAFE', text: '1E40AF' },     // Pastel Blue - light blue background with dark blue text
};

/**
 * Get risk color for text (backward compatibility)
 */
const getRiskColor = (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'): string => {
  return RISK_COLORS[severity]?.fill || 'FFFFFF';
};

/**
 * Get status color for overall compliance status
 */
const getStatusColor = (status: 'PASS' | 'FAIL' | 'PARTIAL'): string => {
  switch (status) {
    case 'PASS':
      return '32CD32'; // Green
    case 'FAIL':
      return 'FF0000'; // Red
    case 'PARTIAL':
      return 'FFD700'; // Yellow/Gold
    default:
      return '808080'; // Gray
  }
};

/**
 * Generate executive summary text
 */
function generateExecutiveSummary(
  analysisData: AnalysisData,
  metadata: DocumentMetadata
): string {
  const totalIssues = analysisData.findings.length + analysisData.violations.length;
  const criticalCount = [
    ...analysisData.findings,
    ...analysisData.violations,
  ].filter((item) => item.severity === 'CRITICAL').length;
  const highCount = [
    ...analysisData.findings,
    ...analysisData.violations,
  ].filter((item) => item.severity === 'HIGH').length;

  // Build summary focusing on key concerns
  let summary = `This ${metadata.fileName.includes('MSA') || metadata.fileName.includes('msa') ? 'Master Service Agreement' : 'contract document'} contains `;
  
  if (criticalCount > 0 || highCount > 0) {
    summary += `several provisions requiring attention. `;
    if (criticalCount > 0) {
      summary += `Key concerns include ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''}`;
      if (highCount > 0) {
        summary += ` and ${highCount} high-risk issue${highCount > 1 ? 's' : ''}`;
      }
      summary += '. ';
    } else if (highCount > 0) {
      summary += `Key concerns include ${highCount} high-risk issue${highCount > 1 ? 's' : ''}. `;
    }
  } else {
    summary += `some provisions that should be reviewed. `;
  }

  // Add specific examples if available
  const sampleFinding = analysisData.findings[0] || analysisData.violations[0];
  if (sampleFinding) {
    const category = sampleFinding.category || 'general terms';
    summary += `Notable areas include ${category.toLowerCase()}. `;
  }

  summary += `While the overall compliance score is ${analysisData.score}/100, `;
  
  if (analysisData.status === 'FAIL') {
    summary += 'this contract requires significant review and negotiation before execution.';
  } else if (analysisData.status === 'PARTIAL') {
    summary += 'several terms should be addressed to improve the agreement.';
  } else {
    summary += 'all findings should still be reviewed by legal counsel.';
  }

  return summary;
}

/**
 * Generate a professional Word document from compliance analysis results
 */
export async function generateComplianceReport(
  analysisData: AnalysisData,
  metadata: DocumentMetadata
): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Contract Red Flags Analysis Report',
                    bold: true,
                    size: 20,
                  }),
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 200 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Page ',
                  }),
                  PageNumber.CURRENT,
                  new TextRun({
                    text: ' of ',
                  }),
                  PageNumber.TOTAL_PAGES,
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'Contract Red Flags Analysis Report',
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Document Metadata Section as Table
          createDocumentInfoTable(metadata, analysisData),

          // Executive Summary
          new Paragraph({
            children: [
              new TextRun({
                text: 'Executive Summary',
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: generateExecutiveSummary(analysisData, metadata),
              }),
            ],
            spacing: { after: 400 },
          }),

          // Red Flags Table Section
          new Paragraph({
            children: [
              new TextRun({
                text: 'Red Flags Analysis',
                bold: true,
                size: 24,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `The following ${analysisData.findings.length + analysisData.violations.length} issues were identified:`,
              }),
            ],
            spacing: { after: 200 },
          }),

          // Create table with findings and violations
          createRedFlagsTable(analysisData),
          new Paragraph({
            children: [],
            spacing: { after: 400 },
          }),

          // Recommendations Section
          ...(analysisData.recommendations.length > 0
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Recommendations',
                      bold: true,
                      size: 24,
                    }),
                  ],
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 400, after: 200 },
                }),
                ...analysisData.recommendations.map(
                  (rec, index) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `${index + 1}. ${rec.action}`,
                        }),
                      ],
                      spacing: { after: 150 },
                    })
                ),
              ]
            : []),

          // Disclaimer
          new Paragraph({
            children: [
              new TextRun({
                text: 'DISCLAIMER: This analysis is for informational purposes only and does not constitute legal advice.',
                bold: true,
              }),
            ],
            spacing: { before: 400, after: 200 },
            alignment: AlignmentType.LEFT,
          }),
        ],
      },
    ],
  });

  // Generate the document buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Create document information table
 */
function createDocumentInfoTable(
  metadata: DocumentMetadata,
  analysisData: AnalysisData
): Table {
  // Get status color for overall risk
  const statusColor = analysisData.status === 'PASS'
    ? RISK_COLORS.LOW
    : analysisData.status === 'FAIL'
    ? RISK_COLORS.CRITICAL
    : RISK_COLORS.MEDIUM;

  return new Table({
    rows: [
      // Document row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Document:',
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              fill: 'E5E7EB', // Light gray for labels
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
            width: { size: 30, type: WidthType.PERCENTAGE },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: metadata.fileName,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              fill: 'F9FAFB', // Very light gray for values
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      // Date Analyzed row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Date Analyzed:',
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'E5E7EB',
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: metadata.dateAnalyzed.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }),
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F9FAFB',
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
        ],
      }),
      // Overall Risk row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Overall Risk:',
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'E5E7EB',
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: analysisData.status,
                    color: statusColor.text,
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: statusColor.fill,
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
        ],
      }),
      // Compliance Score row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Compliance Score:',
                    bold: true,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'E5E7EB',
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${analysisData.score}/100`,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F9FAFB',
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
        ],
      }),
    ],
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

/**
 * Create a risk badge cell with colored background
 */
function createRiskBadgeCell(
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
  rowShading?: string
): TableCell {
  const colors = RISK_COLORS[riskLevel];
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: riskLevel,
            color: colors.text,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      type: ShadingType.CLEAR,
      fill: colors.fill, // Background fill color
    },
    margins: {
      top: 80,
      bottom: 80,
      left: 120,
      right: 120,
    },
  });
}

/**
 * Generate a recommendation text based on finding/violation details
 */
function generateRecommendation(
  category: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
  description: string
): string {
  const categoryLower = category.toLowerCase();
  
  // Generate recommendations based on category and severity
  if (severity === 'INFO') {
    return 'Standard provision - review for needs';
  }
  
  if (severity === 'LOW') {
    return 'No action needed - favorable term';
  }
  
  // Category-based recommendations
  if (categoryLower.includes('financial') || categoryLower.includes('payment') || categoryLower.includes('interest')) {
    if (description.toLowerCase().includes('interest') || description.toLowerCase().includes('rate')) {
      return 'Negotiate reduction to market standard (1.5% or less)';
    }
    return 'Review and negotiate financial terms';
  }
  
  if (categoryLower.includes('termination') || categoryLower.includes('renewal') || categoryLower.includes('notice')) {
    if (description.toLowerCase().includes('notice') || description.toLowerCase().includes('day')) {
      return 'Request 60-day notice period';
    }
    return 'Negotiate termination terms';
  }
  
  if (categoryLower.includes('liability') || categoryLower.includes('indemnification') || categoryLower.includes('remedy')) {
    if (description.toLowerCase().includes('sole remedy') || description.toLowerCase().includes('exclusive')) {
      return 'Add carve-outs for gross negligence or willful misconduct';
    }
    return 'Review liability limitations and negotiate carve-outs';
  }
  
  if (categoryLower.includes('data') || categoryLower.includes('privacy') || categoryLower.includes('breach')) {
    if (description.toLowerCase().includes('notification') || description.toLowerCase().includes('hour')) {
      return 'Verify breach notification timeline meets requirements';
    }
    return 'Ensure data privacy provisions meet regulatory requirements';
  }
  
  if (categoryLower.includes('ip') || categoryLower.includes('intellectual') || categoryLower.includes('ownership')) {
    return 'Review IP ownership and licensing terms';
  }
  
  if (categoryLower.includes('service') || categoryLower.includes('sla') || categoryLower.includes('level')) {
    return 'Review service level commitments and remedies';
  }
  
  // Default recommendations based on severity
  if (severity === 'CRITICAL') {
    return 'Immediate review and negotiation required';
  }
  
  if (severity === 'HIGH') {
    return 'Review and negotiate before execution';
  }
  
  if (severity === 'MEDIUM') {
    return 'Review clause and negotiate if necessary';
  }
  
  return 'Review for appropriateness';
}

/**
 * Create a comprehensive red flags table combining findings and violations
 */
function createRedFlagsTable(analysisData: AnalysisData): Table | Paragraph {
  // Combine findings and violations into a single array for the table
  const allRedFlags: Array<{
    category: string;
    issue: string;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    recommendation: string;
  }> = [];

  // Add findings
  analysisData.findings.forEach((finding) => {
    allRedFlags.push({
      category: finding.category || 'General',
      issue: finding.description,
      riskLevel: finding.severity,
      recommendation: generateRecommendation(
        finding.category || 'General',
        finding.severity,
        finding.description
      ),
    });
  });

  // Add violations
  analysisData.violations.forEach((violation) => {
    allRedFlags.push({
      category: violation.rule,
      issue: violation.description,
      riskLevel: violation.severity,
      recommendation: generateRecommendation(
        violation.rule,
        violation.severity,
        violation.description
      ),
    });
  });

  // If no red flags, return a message paragraph
  if (allRedFlags.length === 0) {
    return new Paragraph({
      children: [
        new TextRun({
          text: 'No red flags identified in this analysis.',
        }),
      ],
      spacing: { after: 200 },
    });
  }

  // Create table rows
  const tableRows = [
    // Header row with dark navy background
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Category',
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: '1E3A5F', // Dark navy
          },
          width: { size: 20, type: WidthType.PERCENTAGE },
          margins: {
            top: 80,
            bottom: 80,
            left: 120,
            right: 120,
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Issue',
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: '1E3A5F', // Dark navy
          },
          width: { size: 35, type: WidthType.PERCENTAGE },
          margins: {
            top: 80,
            bottom: 80,
            left: 120,
            right: 120,
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Risk',
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: '1E3A5F', // Dark navy
          },
          width: { size: 15, type: WidthType.PERCENTAGE },
          margins: {
            top: 80,
            bottom: 80,
            left: 120,
            right: 120,
          },
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Recommendation',
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: '1E3A5F', // Dark navy
          },
          width: { size: 30, type: WidthType.PERCENTAGE },
          margins: {
            top: 80,
            bottom: 80,
            left: 120,
            right: 120,
          },
        }),
      ],
    }),
    // Data rows with alternating colors
    ...allRedFlags.map((flag, index) => {
      const rowShading = index % 2 === 0 ? 'FFFFFF' : 'F3F4F6'; // White and light gray
      return new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: flag.category,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: rowShading,
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: flag.issue,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: rowShading,
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
          // Risk Level cell with colored badge
          createRiskBadgeCell(flag.riskLevel, rowShading),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: flag.recommendation,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.CLEAR,
              fill: rowShading,
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 120,
              right: 120,
            },
          }),
        ],
      });
    }),
  ];

  return new Table({
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
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}
