/**
 * Audit logging service
 * Logs all significant actions in the system for compliance and tracking
 */

import { db } from './db';

export type ResourceType = 'skill' | 'version' | 'user' | 'auth' | 'mcp' | 'agent' | 'workflow' | 'align';

export interface AuditEntry {
  action: string;
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Core audit logging function
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        details: entry.details || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    });
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error('Failed to log audit entry:', error);
  }
}

/**
 * Extract IP address from request headers
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0];
    if (firstIp) {
      return firstIp.trim();
    }
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return undefined;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Convenience functions for common audit actions
 */
export const audit = {
  // Skills
  skillCreated: (skillId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'skill.created',
      resourceType: 'skill',
      resourceId: skillId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  skillUpdated: (skillId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'skill.updated',
      resourceType: 'skill',
      resourceId: skillId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  skillArchived: (skillId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'skill.archived',
      resourceType: 'skill',
      resourceId: skillId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  skillRestored: (skillId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'skill.restored',
      resourceType: 'skill',
      resourceId: skillId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Versions
  versionCreated: (versionId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'version.created',
      resourceType: 'version',
      resourceId: versionId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  versionSubmitted: (versionId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'version.submitted',
      resourceType: 'version',
      resourceId: versionId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  versionApproved: (versionId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'version.approved',
      resourceType: 'version',
      resourceId: versionId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  versionRejected: (versionId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'version.rejected',
      resourceType: 'version',
      resourceId: versionId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Users (Admin)
  userCreated: (targetUserId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'user.created',
      resourceType: 'user',
      resourceId: targetUserId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userUpdated: (targetUserId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'user.updated',
      resourceType: 'user',
      resourceId: targetUserId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userRoleChanged: (targetUserId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'user.role_changed',
      resourceType: 'user',
      resourceId: targetUserId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userDeactivated: (targetUserId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'user.deactivated',
      resourceType: 'user',
      resourceId: targetUserId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userReactivated: (targetUserId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'user.reactivated',
      resourceType: 'user',
      resourceId: targetUserId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Authentication
  authLogin: (userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'auth.login',
      resourceType: 'auth',
      resourceId: userId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  authLogout: (userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'auth.logout',
      resourceType: 'auth',
      resourceId: userId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  authFailed: async (email: string, metadata?: Record<string, unknown>, request?: Request) => {
    // For failed logins, we need a valid userId. Try to find or create a system user.
    // If we can't, we'll skip the audit log (don't break the app)
    try {
      let systemUserId: string | null = null;
      
      // Try to find existing system user
      const systemUser = await db.user.findFirst({
        where: { email: 'system@internal' },
      });
      
      if (systemUser) {
        systemUserId = systemUser.id;
      } else {
        // Try to create a system user for audit purposes
        // Use upsert to handle race conditions
        try {
          const created = await db.user.create({
            data: {
              email: 'system@internal',
              name: 'System',
              authProvider: 'LOCAL',
            },
          });
          systemUserId = created.id;
        } catch (createError: unknown) {
          // If creation fails (e.g., race condition), try to find it again
          const found = await db.user.findFirst({
            where: { email: 'system@internal' },
          });
          if (found) {
            systemUserId = found.id;
          }
        }
      }

      if (systemUserId) {
        return logAudit({
          action: 'auth.failed',
          resourceType: 'auth',
          resourceId: email, // Use email as resourceId for failed logins
          userId: systemUserId,
          details: { email, ...metadata },
          ipAddress: request ? getIpAddress(request) : undefined,
          userAgent: request ? getUserAgent(request) : undefined,
        });
      }
    } catch (error) {
      // Silently fail - don't break authentication flow
      console.error('Failed to log failed login audit:', error);
    }
  },

  // MCP
  mcpSkillExecuted: (skillId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'mcp.skill_executed',
      resourceType: 'mcp',
      resourceId: skillId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Agent Runs
  agentRunCreated: (runId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.run.created',
      resourceType: 'agent',
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentRunCompleted: (runId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.run.completed',
      resourceType: 'agent',
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentRunFailed: (runId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.run.failed',
      resourceType: 'agent',
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentRunCancelled: (runId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.run.cancelled',
      resourceType: 'agent',
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentStepExecuted: (stepId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.step.executed',
      resourceType: 'agent',
      resourceId: stepId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentStepFailed: (stepId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.step.failed',
      resourceType: 'agent',
      resourceId: stepId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentApprovalRequested: (approvalId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.approval.requested',
      resourceType: 'agent',
      resourceId: approvalId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentApprovalApproved: (approvalId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.approval.approved',
      resourceType: 'agent',
      resourceId: approvalId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentApprovalRejected: (approvalId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'agent.approval.rejected',
      resourceType: 'agent',
      resourceId: approvalId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Workflows
  workflowCreated: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  workflowUpdated: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.updated',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  workflowArchived: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.archived',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  workflowPublished: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.published',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  workflowShared: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.shared',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  workflowUnshared: (workflowId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
    logAudit({
      action: 'workflow.unshared',
      resourceType: 'workflow',
      resourceId: workflowId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),
};
