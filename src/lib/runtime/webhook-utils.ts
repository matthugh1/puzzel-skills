/**
 * Webhook Utilities
 * Functions for generating webhook paths and verifying signatures
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

/**
 * Generate cryptographically secure webhook path
 */
export function generateWebhookPath(): string {
  // Generate cryptographically secure random path
  return `wh_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate webhook secret
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Verify webhook signature using HMAC SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
