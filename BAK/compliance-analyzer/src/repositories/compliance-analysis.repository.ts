import { db } from '@shared/database';
import type { ComplianceStatus, Prisma } from '@prisma/client';

export interface CreateComplianceAnalysisInput {
  documentId: string;
  userId: string;
  skillId: string;
  score: number;
  status: ComplianceStatus;
  findings: unknown; // JSON
  violations: unknown; // JSON
  recommendations: unknown; // JSON
  rawResponse?: unknown; // JSON
  completedAt?: Date;
}

export interface UpdateComplianceAnalysisInput {
  score?: number;
  status?: ComplianceStatus;
  findings?: unknown;
  violations?: unknown;
  recommendations?: unknown;
  rawResponse?: unknown;
  completedAt?: Date;
}

/**
 * Compliance Analysis Repository
 * Data access layer for compliance analyses with user isolation
 */
class ComplianceAnalysisRepository {
  /**
   * Create a new compliance analysis
   */
  async create(input: CreateComplianceAnalysisInput) {
    return db.complianceAnalysis.create({
      data: {
        documentId: input.documentId,
        userId: input.userId,
        skillId: input.skillId,
        score: input.score,
        status: input.status,
        findings: input.findings,
        violations: input.violations,
        recommendations: input.recommendations,
        rawResponse: input.rawResponse,
        completedAt: input.completedAt || new Date(),
      },
      include: {
        document: true,
      },
    });
  }

  /**
   * Find analysis by ID (with user isolation)
   */
  async findById(id: string, userId: string) {
    return db.complianceAnalysis.findFirst({
      where: {
        id,
        userId, // User isolation
      },
      include: {
        document: true,
      },
    });
  }

  /**
   * Find analysis by document ID (with user isolation)
   */
  async findByDocumentId(documentId: string, userId: string) {
    return db.complianceAnalysis.findFirst({
      where: {
        documentId,
        userId, // User isolation
      },
      include: {
        document: true,
      },
    });
  }

  /**
   * List analyses for a user with filters
   */
  async findByUser(
    userId: string,
    options: {
      skip?: number;
      take?: number;
      skillId?: string;
      status?: ComplianceStatus;
      orderBy?: Prisma.ComplianceAnalysisOrderByWithRelationInput;
    } = {}
  ) {
    const {
      skip = 0,
      take = 20,
      skillId,
      status,
      orderBy = { completedAt: 'desc' },
    } = options;

    const where: Prisma.ComplianceAnalysisWhereInput = {
      userId, // User isolation
    };

    if (skillId) {
      where.skillId = skillId;
    }

    if (status) {
      where.status = status;
    }

    const [analyses, total] = await Promise.all([
      db.complianceAnalysis.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              createdAt: true,
            },
          },
        },
      }),
      db.complianceAnalysis.count({ where }),
    ]);

    return {
      analyses,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Update an analysis (with user isolation)
   */
  async update(
    id: string,
    userId: string,
    data: UpdateComplianceAnalysisInput
  ) {
    // Verify ownership first
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Analysis not found or access denied');
    }

    return db.complianceAnalysis.update({
      where: { id },
      data,
      include: {
        document: true,
      },
    });
  }
}

export const complianceAnalysisRepository = new ComplianceAnalysisRepository();
