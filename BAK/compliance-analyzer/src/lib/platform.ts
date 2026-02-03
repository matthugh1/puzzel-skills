import { db } from '@shared/database';
import { hasPermission } from '@shared/permissions';
import { getUserApplications } from '../../../platform-core/src/lib/app-registry';

/**
 * Platform utilities for applications built on the foundation
 */

export interface PlatformConfig {
  applicationId: string;
  applicationSlug: string;
}

/**
 * Check if a user has access to this application
 */
export async function checkApplicationAccess(
  userId: string,
  applicationSlug: string
): Promise<boolean> {
  const application = await db.application.findUnique({
    where: { slug: applicationSlug },
  });

  if (!application || !application.enabled) {
    return false;
  }

  const userApplication = await db.userApplication.findUnique({
    where: {
      userId_applicationId: {
        userId,
        applicationId: application.id,
      },
    },
  });

  return userApplication?.enabled ?? false;
}

/**
 * Check if a user has a specific permission in this application
 */
export async function checkPermission(
  userId: string,
  applicationSlug: string,
  permissionSlug: string
): Promise<boolean> {
  const application = await db.application.findUnique({
    where: { slug: applicationSlug },
  });

  if (!application) {
    return false;
  }

  return hasPermission({
    userId,
    applicationId: application.id,
    permissionSlug,
  });
}

/**
 * Get user's applications
 */
export async function getUserApps(userId: string) {
  return getUserApplications(userId);
}
