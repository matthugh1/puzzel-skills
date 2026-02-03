/**
 * Input validation schemas using Zod
 * All user input must be validated before processing
 */

import { z } from 'zod';

// Email validation
const emailSchema = z.string().email().max(255).toLowerCase().trim();

// Password validation - minimum 8 chars, at least one uppercase, lowercase, number, and special char
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// Common validation schemas
export const validationSchemas = {
  // Authentication
  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),

  // User management
  createUser: z.object({
    email: emailSchema,
    name: z.string().min(1).max(255).trim().optional(),
    password: passwordSchema.optional(),
    roleIds: z.array(z.string().cuid()).optional(),
  }),

  updateUser: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
    roleIds: z.array(z.string().cuid()).optional(),
  }),

  // Skills
  createSkill: z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    description: z.string().max(1000).trim().optional(),
    content: z.string().min(1, 'Content is required').max(50000).trim(),
    category: z.string().max(100).trim().optional(),
    tags: z.array(z.string().max(50).trim()).max(20).optional(),
    visibility: z.enum(['TEAM', 'ORG']).optional(),
    toolId: z.string().max(100).trim().optional(),
  }),

  updateSkill: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    category: z.string().max(100).trim().optional(),
    tags: z.array(z.string().max(50).trim()).max(20).optional(),
    toolId: z.string().max(100).trim().optional(),
  }),

  // Skill versions
  createVersion: z.object({
    content: z.string().min(1, 'Content is required').max(50000).trim(),
    changeNotes: z.string().max(1000).trim().optional(),
  }),

  submitVersion: z.object({
    versionId: z.string().cuid(),
    changeNotes: z.string().max(1000).trim().optional(),
  }),

  approveVersion: z.object({
    versionId: z.string().cuid(),
    comments: z.string().max(1000).trim().optional(),
  }),

  rejectVersion: z.object({
    versionId: z.string().cuid(),
    reason: z.string().min(1, 'Rejection reason is required').max(1000).trim(),
  }),

  // MCP
  mcpCall: z.object({
    method: z.enum(['tools/list', 'tools/call']),
    name: z.string().max(200).optional(),
    arguments: z.record(z.string(), z.any()).optional(),
  }),

  // Search/Filter
  searchParams: z.object({
    search: z.string().max(200).trim().optional(),
    category: z.string().max(100).trim().optional(),
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED']).optional(),
    role: z.string().max(100).trim().optional(),
  }),

  // Agent Runs
  createRun: z.object({
    goal: z.string().min(1, 'Goal is required').max(1000).trim(),
    initialContext: z.record(z.string(), z.any()),
    policyId: z.string().cuid().optional(),
    inputAllowlist: z.array(z.string()).nullable().optional(),
    idempotencyKey: z.string().max(255).trim().optional(),
  }),

  cancelRun: z.object({
    reason: z.string().max(500).trim().optional(),
  }),

  approveRun: z.object({
    comments: z.string().max(1000).trim().optional(),
  }),

  rejectRun: z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(1000).trim(),
  }),

  // Workflows
  createWorkflow: z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    description: z.string().max(1000).trim().optional(),
    category: z.string().max(100).trim().optional(),
    tags: z.array(z.string().max(50).trim()).max(20).optional(),
    plan: z.object({
      steps: z.array(z.any()).min(1, 'Workflow must have at least one step'),
      metadata: z.object({
        version: z.string().optional(),
        description: z.string().optional(),
      }).optional(),
    }),
    visibility: z.enum(['TEAM', 'ORG']).optional(),
    llmProvider: z.enum(['openai', 'anthropic']).optional(),
    llmModel: z.string().max(100).trim().optional(),
  }),

  updateWorkflow: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    category: z.string().max(100).trim().optional(),
    tags: z.array(z.string().max(50).trim()).max(20).optional(),
    plan: z.object({
      steps: z.array(z.any()).min(1),
      metadata: z.object({
        version: z.string().optional(),
        description: z.string().optional(),
      }).optional(),
    }).optional(),
    visibility: z.enum(['TEAM', 'ORG']).optional(),
    folderId: z.string().cuid().nullable().optional(),
    llmProvider: z.enum(['openai', 'anthropic']).nullable().optional(),
    llmModel: z.string().max(100).trim().nullable().optional(),
  }),

  runWorkflow: z.object({
    initialContext: z.record(z.string(), z.any()),
    policyId: z.string().cuid().optional(),
    inputAllowlist: z.array(z.string()).nullable().optional(),
    idempotencyKey: z.string().max(255).trim().optional(),
    plan: z.object({
      steps: z.array(z.any()).min(1).optional(),
      metadata: z.object({
        version: z.string().optional(),
        description: z.string().optional(),
      }).optional(),
    }).optional(), // Optional plan override for testing unsaved changes
  }),

  // Triggers
  createTrigger: z.object({
    triggerType: z.enum(['MANUAL', 'WEBHOOK', 'SCHEDULED', 'APP_EVENT']),
    config: z.record(z.string(), z.any()),
  }),

  // Align
  createAlignmentSnapshot: z.object({
    title: z.string().min(1, 'Title is required').max(200).trim(),
    summary: z.string().max(2000).trim().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  }),

  updateAlignmentSnapshot: z.object({
    title: z.string().min(1).max(200).trim().optional(),
    summary: z.string().max(2000).trim().optional(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  }),

  createOpportunity: z.object({
    snapshotId: z.string().cuid(),
    title: z.string().min(1).max(200).trim(),
    description: z.string().max(2000).trim().optional(),
    department: z.string().max(100).trim().optional(),
    valueScore: z.number().int().min(1).max(5),
    feasibilityScore: z.number().int().min(1).max(5),
    timeToPilotWeeks: z.number().int().min(1).max(104).optional(),
    status: z.enum(['IDEA', 'PRIORITIZED', 'DEFERRED']).optional(),
  }),

  updateOpportunity: z.object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(2000).trim().optional(),
    department: z.string().max(100).trim().optional(),
    valueScore: z.number().int().min(1).max(5).optional(),
    feasibilityScore: z.number().int().min(1).max(5).optional(),
    timeToPilotWeeks: z.number().int().min(1).max(104).optional(),
    status: z.enum(['IDEA', 'PRIORITIZED', 'DEFERRED']).optional(),
  }),

  createRoadmapItem: z.object({
    snapshotId: z.string().cuid(),
    opportunityId: z.string().cuid().optional(),
    title: z.string().min(1).max(200).trim(),
    priority: z.number().int().min(1).max(999),
    targetQuarter: z.string().max(20).trim().optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
  }),

  updateRoadmapItem: z.object({
    opportunityId: z.string().cuid().nullable().optional(),
    title: z.string().min(1).max(200).trim().optional(),
    priority: z.number().int().min(1).max(999).optional(),
    targetQuarter: z.string().max(20).trim().optional(),
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
  }),

  createCoalitionMember: z.object({
    snapshotId: z.string().cuid(),
    userId: z.string().cuid(),
    role: z.enum(['SPONSOR', 'LEAD', 'CHAMPION', 'IT', 'SECURITY', 'LND']),
    notes: z.string().max(1000).trim().optional(),
  }),

  updateCoalitionMember: z.object({
    role: z.enum(['SPONSOR', 'LEAD', 'CHAMPION', 'IT', 'SECURITY', 'LND']).optional(),
    notes: z.string().max(1000).trim().optional(),
  }),

  createGuardrailPolicy: z.object({
    snapshotId: z.string().cuid(),
    allowedCategories: z.array(z.string().max(100).trim()).max(100),
    blockedCategories: z.array(z.string().max(100).trim()).max(100),
    requiresApproval: z.boolean().optional(),
    notes: z.string().max(2000).trim().optional(),
  }),

  updateGuardrailPolicy: z.object({
    allowedCategories: z.array(z.string().max(100).trim()).max(100).optional(),
    blockedCategories: z.array(z.string().max(100).trim()).max(100).optional(),
    requiresApproval: z.boolean().optional(),
    notes: z.string().max(2000).trim().optional(),
  }),

  alignUserSearch: z.object({
    search: z.string().min(2).max(200).trim(),
  }),
};

/**
 * Validate request body against a schema
 * Returns validated data or throws error
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid request data', error.errors);
    }
    throw error;
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Check if error is a Zod validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Sanitize object values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value) as T[Extract<keyof T, string>];
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>) as T[Extract<keyof T, string>];
    }
  }
  return sanitized;
}
