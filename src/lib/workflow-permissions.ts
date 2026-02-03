/**
 * Workflow Permission Utilities
 * Checks workflow access permissions including ownership and sharing
 */

import { db } from './db';
import type { AuthUser } from './auth';

export type WorkflowPermission = 'VIEWER' | 'EDITOR' | 'OWNER';

export interface WorkflowAccessResult {
  hasAccess: boolean;
  permission: WorkflowPermission | null;
}

/**
 * Check if user has access to a workflow
 */
export async function checkWorkflowAccess(
  userId: string,
  workflowId: string
): Promise<WorkflowAccessResult> {
  const workflow = await db.workflow.findUnique({
    where: { id: workflowId },
    include: {
      owner: true,
      shares: {
        where: {
          userId,
        },
      },
    },
  });

  if (!workflow) {
    return { hasAccess: false, permission: null };
  }

  // Owner has full access
  if (workflow.ownerId === userId) {
    return { hasAccess: true, permission: 'OWNER' };
  }

  // Check sharing
  const share = workflow.shares[0];
  if (share) {
    return {
      hasAccess: true,
      permission: share.permission === 'EDITOR' ? 'EDITOR' : 'VIEWER',
    };
  }

  // Check visibility (ORG = everyone can view, TEAM = team members only)
  if (workflow.visibility === 'ORG') {
    return { hasAccess: true, permission: 'VIEWER' };
  }

  // TEAM visibility - TODO: Check team membership
  // For now, only owner and shared users have access
  return { hasAccess: false, permission: null };
}

/**
 * Check if user can edit a workflow
 */
export async function canEditWorkflow(
  userId: string,
  workflowId: string
): Promise<boolean> {
  const access = await checkWorkflowAccess(userId, workflowId);
  return access.hasAccess && (access.permission === 'OWNER' || access.permission === 'EDITOR');
}

/**
 * Check if user can view a workflow
 */
export async function canViewWorkflow(
  userId: string,
  workflowId: string
): Promise<boolean> {
  const access = await checkWorkflowAccess(userId, workflowId);
  return access.hasAccess;
}
