import { db } from '@shared/database';
import type { DocumentStatus, Prisma } from '@prisma/client';

export interface CreateComplianceDocumentInput {
  userId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  skillId: string;
  skillName: string;
  status?: DocumentStatus;
}

export interface UpdateComplianceDocumentInput {
  status?: DocumentStatus;
  skillId?: string;
  skillName?: string;
}

/**
 * Compliance Document Repository
 * Data access layer for compliance documents with user isolation
 */
class ComplianceDocumentRepository {
  /**
   * Create a new compliance document
   */
  async create(input: CreateComplianceDocumentInput) {
    return db.complianceDocument.create({
      data: {
        userId: input.userId,
        fileName: input.fileName,
        filePath: input.filePath,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        skillId: input.skillId,
        skillName: input.skillName,
        status: input.status || 'PENDING',
      },
      include: {
        analysis: true,
      },
    });
  }

  /**
   * Find document by ID (with user isolation)
   */
  async findById(id: string, userId: string) {
    return db.complianceDocument.findFirst({
      where: {
        id,
        userId, // User isolation
      },
      include: {
        analysis: true,
      },
    });
  }

  /**
   * List documents for a user with filters and pagination
   */
  async findByUser(
    userId: string,
    options: {
      skip?: number;
      take?: number;
      status?: DocumentStatus;
      skillId?: string;
      search?: string;
      orderBy?: Prisma.ComplianceDocumentOrderByWithRelationInput;
    } = {}
  ) {
    const {
      skip = 0,
      take = 20,
      status,
      skillId,
      search,
      orderBy = { createdAt: 'desc' },
    } = options;

    const where: Prisma.ComplianceDocumentWhereInput = {
      userId, // User isolation
    };

    if (status) {
      where.status = status;
    }

    if (skillId) {
      where.skillId = skillId;
    }

    if (search) {
      where.fileName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [documents, total] = await Promise.all([
      db.complianceDocument.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          analysis: {
            select: {
              id: true,
              score: true,
              status: true,
              completedAt: true,
            },
          },
        },
      }),
      db.complianceDocument.count({ where }),
    ]);

    return {
      documents,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Update a document (with user isolation)
   */
  async update(
    id: string,
    userId: string,
    data: UpdateComplianceDocumentInput
  ) {
    // Verify ownership first
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Document not found or access denied');
    }

    return db.complianceDocument.update({
      where: { id },
      data,
      include: {
        analysis: true,
      },
    });
  }

  /**
   * Delete a document (with user isolation)
   */
  async delete(id: string, userId: string) {
    // Verify ownership first
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Document not found or access denied');
    }

    return db.complianceDocument.delete({
      where: { id },
    });
  }
}

export const complianceDocumentRepository = new ComplianceDocumentRepository();
