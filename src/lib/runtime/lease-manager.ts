/**
 * Lease Manager
 * Manages run-level leases for distributed execution
 * Uses atomic conditional updates to prevent split-brain
 */

import { db } from '@/lib/db';

const LEASE_TTL_SECONDS = 300; // 5 minutes default

/**
 * Acquire run lease atomically
 * Returns true if lease acquired, false if already held
 */
export async function acquireLease(
  runId: string,
  workerId: string,
  ttlSeconds: number = LEASE_TTL_SECONDS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Atomic conditional update: only acquire if lease is expired or null
  const result = await db.agentRun.updateMany({
    where: {
      id: runId,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      leaseOwner: workerId,
      leaseExpiresAt: expiresAt,
    },
  });

  // If 0 rows updated, lease was not acquired (already held)
  return result.count > 0;
}

/**
 * Refresh lease expiration time
 */
export async function refreshLease(
  runId: string,
  workerId: string,
  ttlSeconds: number = LEASE_TTL_SECONDS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Only refresh if we own the lease
  const result = await db.agentRun.updateMany({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
    data: {
      leaseExpiresAt: expiresAt,
    },
  });

  return result.count > 0;
}

/**
 * Release lease
 */
export async function releaseLease(
  runId: string,
  workerId: string
): Promise<void> {
  await db.agentRun.updateMany({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
    data: {
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
}

/**
 * Check if lease is expired
 */
export async function isLeaseExpired(runId: string): Promise<boolean> {
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { leaseExpiresAt: true },
  });

  if (!run || !run.leaseExpiresAt) {
    return true; // No lease = expired
  }

  return run.leaseExpiresAt < new Date();
}

/**
 * Mark stale steps as FAILED_STALE
 * Only callable by current lease owner
 */
export async function markStaleSteps(
  runId: string,
  workerId: string
): Promise<void> {
  // Verify we own the lease
  const run = await db.agentRun.findUnique({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
  });

  if (!run) {
    throw new Error('Cannot mark stale steps: lease not owned');
  }

  // Mark RUNNING steps as FAILED_STALE
  await db.runStep.updateMany({
    where: {
      runId,
      status: 'RUNNING',
    },
    data: {
      status: 'FAILED_STALE',
    },
  });
}
