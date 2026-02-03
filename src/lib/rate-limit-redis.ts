/**
 * Redis-based Rate Limiting (Optional)
 * Use this for distributed rate limiting in multi-instance deployments
 * 
 * To use Redis rate limiting:
 * 1. Install: pnpm add @upstash/ratelimit @upstash/redis
 * 2. Set REDIS_URL environment variable
 * 3. Replace rateLimitStore with RedisRateLimitStore
 * 
 * Example:
 * import { RedisRateLimitStore } from './rate-limit-redis';
 * const rateLimitStore = new RedisRateLimitStore();
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Redis-based rate limit store
 * Requires @upstash/ratelimit and @upstash/redis packages
 */
export class RedisRateLimitStore {
  private ratelimit: Ratelimit;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required for Redis rate limiting');
    }

    const redis = new Redis({ url: redisUrl });
    
    // Create rate limiter with different limits for different endpoints
    this.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // Default: 100 requests per minute
      analytics: true,
    });
  }

  /**
   * Check rate limit for an identifier
   */
  async checkLimit(
    identifier: string,
    windowMs: number,
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    // Convert windowMs to seconds for Upstash
    const windowSeconds = Math.ceil(windowMs / 1000);
    
    // Create a custom limiter for this specific limit
    const customLimiter = new Ratelimit({
      redis: this.ratelimit['redis'],
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    });

    const result = await customLimiter.limit(identifier);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: Date.now() + (result.reset - Date.now() / 1000) * 1000,
    };
  }
}

/**
 * Factory function to create appropriate rate limit store
 * Uses Redis if available, falls back to in-memory
 */
export function createRateLimitStore() {
  if (process.env.REDIS_URL) {
    try {
      return new RedisRateLimitStore();
    } catch (error) {
      console.warn('Failed to initialize Redis rate limiting, falling back to in-memory:', error);
      return null; // Will use in-memory fallback
    }
  }
  return null; // Use in-memory fallback
}
