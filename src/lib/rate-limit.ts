/**
 * Rate limiting utilities
 * Prevents abuse and brute force attacks
 */

import { NextResponse } from 'next/server';

// In-memory rate limit store (for single-instance deployments)
// For production multi-instance, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: (request: Request) => string; // Custom identifier function
}

export interface SimpleRateLimitConfig {
  limit: number;
  window: number; // seconds
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  // General API endpoints
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  // MCP endpoints
  MCP: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
} as const;

/**
 * Get identifier for rate limiting
 * Uses IP address or user ID if available
 */
function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP address
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0];
    if (firstIp) {
      return `ip:${firstIp.trim()}`;
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return `ip:${realIp}`;
  }

  // Fallback to a default identifier (less secure)
  return 'unknown';
}

/**
 * Check if request is within rate limit
 */
function checkRateLimit(
  identifier: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Create new record
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Rate limit middleware
 * Returns NextResponse with 429 if rate limit exceeded, or null if allowed
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig | SimpleRateLimitConfig,
  userId?: string
): NextResponse | null {
  // Handle simple config format
  let rateLimitConfig: RateLimitConfig;
  if ('limit' in config && 'window' in config) {
    rateLimitConfig = {
      windowMs: config.window * 1000,
      maxRequests: config.limit,
    };
  } else {
    rateLimitConfig = config as RateLimitConfig;
  }

  const identifier = rateLimitConfig.identifier
    ? rateLimitConfig.identifier(request)
    : getIdentifier(request, userId);

  const result = checkRateLimit(
    identifier,
    rateLimitConfig.windowMs,
    rateLimitConfig.maxRequests
  );

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateLimitConfig.maxRequests.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
        },
      }
    );
  }

  return null;
}

/**
 * Track failed login attempts for account lockout
 */
const failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

export function trackFailedLogin(email: string): { locked: boolean; attemptsRemaining: number } {
  const key = `login:${email.toLowerCase()}`;
  const maxAttempts = 5;
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes

  const record = failedLoginAttempts.get(key);
  const now = Date.now();

  // Check if account is locked
  if (record?.lockedUntil && now < record.lockedUntil) {
    return {
      locked: true,
      attemptsRemaining: 0,
    };
  }

  // Reset if lockout expired
  if (record?.lockedUntil && now >= record.lockedUntil) {
    failedLoginAttempts.delete(key);
  }

  // Increment failed attempts
  const currentRecord = failedLoginAttempts.get(key) || { count: 0 };
  currentRecord.count++;

  if (currentRecord.count >= maxAttempts) {
    // Lock account
    currentRecord.lockedUntil = now + lockoutDuration;
    failedLoginAttempts.set(key, currentRecord);
    return {
      locked: true,
      attemptsRemaining: 0,
    };
  }

  failedLoginAttempts.set(key, currentRecord);
  return {
    locked: false,
    attemptsRemaining: maxAttempts - currentRecord.count,
  };
}

export function clearFailedLoginAttempts(email: string): void {
  const key = `login:${email.toLowerCase()}`;
  failedLoginAttempts.delete(key);
}
