# Security Audit Report
**Date:** February 1, 2026  
**Project:** Skills Library  
**Auditor:** AI Security Analysis

## Executive Summary

This security audit identified **15 critical and high-priority security issues** across authentication, authorization, input validation, secrets management, and infrastructure security. The application uses Next.js with Prisma ORM and implements a basic RBAC system, but several security vulnerabilities need immediate attention before production deployment.

---

## 🔴 CRITICAL ISSUES

### 1. **Weak Password Hashing Algorithm**
**Location:** `src/lib/auth/simple-auth.ts:18-22`  
**Severity:** CRITICAL  
**Risk:** Passwords are hashed using SHA-256 with a static salt, which is vulnerable to rainbow table attacks and brute force attacks.

```typescript
function hashPassword(password: string): string {
  return createHash('sha256')
    .update(password + 'skills-library-salt')
    .digest('hex');
}
```

**Recommendation:**
- Replace with `bcrypt` or `argon2` (industry standard)
- Use a cost factor of at least 12 for bcrypt
- Each password should have a unique salt (bcrypt handles this automatically)

**Fix:**
```typescript
import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

### 2. **Hardcoded Default Secret in Production Code**
**Location:** `src/lib/auth/simple-auth.ts:12-14`  
**Severity:** CRITICAL  
**Risk:** If `NEXTAUTH_SECRET` is not set, the application falls back to a hardcoded secret that's visible in the codebase. This compromises JWT token security.

```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
);
```

**Recommendation:**
- Remove the fallback default value
- Ensure `env.ts` validation throws an error if `NEXTAUTH_SECRET` is missing
- Generate a secure secret using: `openssl rand -base64 32`

**Fix:**
```typescript
const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);
```

---

### 3. **No Rate Limiting on Authentication Endpoints**
**Location:** `src/app/api/auth/login/route.ts`  
**Severity:** CRITICAL  
**Risk:** Login endpoint is vulnerable to brute force attacks. Attackers can attempt unlimited password guesses.

**Recommendation:**
- Implement rate limiting on `/api/auth/login`
- Lock accounts after N failed attempts (e.g., 5 attempts)
- Implement exponential backoff or temporary account lockout
- Consider CAPTCHA after multiple failures

**Fix:**
- Add rate limiting middleware similar to MCP route
- Track failed login attempts per email/IP
- Return 429 Too Many Requests when limit exceeded

---

### 4. **Missing Input Validation and Sanitization**
**Location:** Multiple API routes  
**Severity:** CRITICAL  
**Risk:** User input is not validated or sanitized before database operations, leading to potential injection attacks and data corruption.

**Examples:**
- `src/app/api/skills/route.ts:85` - No validation on `name`, `description`, `content`, `tags`
- `src/app/api/users/route.ts:86` - No email format validation
- `src/app/api/mcp/handlers/call.ts:76` - User input merged directly into prompts without sanitization

**Recommendation:**
- Implement input validation using Zod or Yup
- Sanitize all string inputs
- Validate email format
- Enforce maximum length limits
- Validate array inputs (tags, roleIds)

**Example Fix:**
```typescript
import { z } from 'zod';

const createSkillSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional(),
  content: z.string().min(1).max(50000),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  visibility: z.enum(['TEAM', 'ORG']).optional(),
});

const body = createSkillSchema.parse(await request.json());
```

---

### 5. **No CSRF Protection**
**Location:** All API routes  
**Severity:** CRITICAL  
**Risk:** Cross-Site Request Forgery attacks can execute unauthorized actions on behalf of authenticated users.

**Recommendation:**
- Implement CSRF tokens for state-changing operations (POST, PUT, DELETE)
- Use SameSite cookies for session management
- Validate Origin/Referer headers for API requests
- Consider using Next.js built-in CSRF protection

---

### 6. **JWT Token Stored in localStorage**
**Location:** `src/app/login/page.tsx:37`  
**Severity:** CRITICAL  
**Risk:** localStorage is accessible to JavaScript, making tokens vulnerable to XSS attacks. If an XSS vulnerability exists, tokens can be stolen.

**Recommendation:**
- Use httpOnly cookies instead of localStorage for token storage
- Implement secure cookie flags: `httpOnly`, `secure`, `sameSite: 'strict'`
- Consider using Next.js middleware for token management

---

### 7. **Missing Security Headers**
**Location:** `next.config.ts`, `src/app/layout.tsx`  
**Severity:** CRITICAL  
**Risk:** Missing security headers expose the application to various attacks (XSS, clickjacking, MIME sniffing, etc.).

**Recommendation:**
Add security headers in `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
          }
        ],
      },
    ];
  },
};
```

---

## 🟠 HIGH PRIORITY ISSUES

### 8. **In-Memory Rate Limiting (Not Production-Ready)**
**Location:** `src/app/api/mcp/route.ts:16-42`  
**Severity:** HIGH  
**Risk:** Rate limiting uses in-memory storage that resets on server restart. In a multi-instance deployment, each instance has separate limits, effectively multiplying the allowed requests.

**Recommendation:**
- Use Redis or a database-backed rate limiting solution
- Implement distributed rate limiting for multi-instance deployments
- Consider using middleware like `@upstash/ratelimit` or `rate-limiter-flexible`

---

### 9. **No Password Strength Requirements**
**Location:** `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`  
**Severity:** HIGH  
**Risk:** Weak passwords can be easily compromised, especially with the weak hashing algorithm.

**Recommendation:**
- Enforce minimum password length (8+ characters)
- Require mix of uppercase, lowercase, numbers, and special characters
- Use a password strength validator library
- Reject common passwords (use a password blacklist)

---

### 10. **Database Credentials in docker-compose.yml**
**Location:** `docker-compose.yml:7-10`  
**Severity:** HIGH  
**Risk:** Default database credentials are hardcoded and weak. If this file is committed, credentials are exposed.

**Recommendation:**
- Use environment variables for database credentials
- Use strong, randomly generated passwords
- Never commit production credentials to version control

**Fix:**
```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  POSTGRES_DB: ${POSTGRES_DB:-skills_library}
```

---

### 11. **No Input Size Limits**
**Location:** Multiple API routes  
**Severity:** HIGH  
**Risk:** Large payloads can cause DoS attacks, memory exhaustion, or database issues.

**Recommendation:**
- Implement request body size limits
- Set maximum lengths for text fields in database schema
- Add middleware to limit request size
- Configure Next.js body parser limits

**Fix in `next.config.ts`:**
```typescript
const nextConfig: NextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
```

---

### 12. **MCP Tool Input Not Sanitized**
**Location:** `src/app/api/mcp/tools.ts:70-84`  
**Severity:** HIGH  
**Risk:** User input is directly merged into prompt content without sanitization. Malicious input could inject code or break prompt structure.

**Recommendation:**
- Sanitize all user input before merging
- Escape special characters
- Validate input matches expected types
- Consider using a template engine with proper escaping

---

### 13. **No Token Expiration Refresh Mechanism**
**Location:** `src/lib/auth/simple-auth.ts:15`  
**Severity:** HIGH  
**Risk:** Tokens expire after 24 hours with no refresh mechanism. Users must re-authenticate frequently, or tokens are set to very long expiration times, increasing risk if compromised.

**Recommendation:**
- Implement refresh tokens with shorter access token lifetimes (15-30 minutes)
- Store refresh tokens securely (httpOnly cookies)
- Implement token rotation
- Add ability to revoke tokens

---

### 14. **Audit Logging Creates System User**
**Location:** `src/lib/audit.ts:237-288`  
**Severity:** HIGH  
**Risk:** Failed login attempts trigger creation/lookup of a system user. This could be exploited or cause issues if the system user is deleted.

**Recommendation:**
- Use a dedicated system user ID constant instead of email lookup
- Pre-create system user in seed script
- Handle audit logging failures more gracefully
- Consider using a special "SYSTEM" user ID that's reserved

---

### 15. **No CORS Configuration**
**Location:** `next.config.ts`  
**Severity:** HIGH  
**Risk:** Missing CORS configuration could allow unauthorized cross-origin requests or block legitimate frontend access.

**Recommendation:**
- Configure CORS explicitly
- Whitelist allowed origins
- Set appropriate CORS headers for API routes

**Fix:**
```typescript
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
        ],
      },
    ];
  },
};
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 16. **Error Messages May Leak Information**
**Location:** Multiple API routes  
**Severity:** MEDIUM  
**Risk:** Error messages sometimes reveal internal details (e.g., "User has no password set" reveals user existence).

**Recommendation:**
- Use generic error messages for authentication failures
- Log detailed errors server-side only
- Don't reveal whether email exists or not during login

**Example:**
```typescript
// Instead of:
return { success: false, error: 'Invalid email or password' };

// Use consistently:
return { success: false, error: 'Invalid credentials' };
```

---

### 17. **No Request ID Tracking**
**Location:** All API routes  
**Severity:** MEDIUM  
**Risk:** Difficult to trace requests across logs and debug issues.

**Recommendation:**
- Add request ID middleware
- Include request ID in all logs and error responses
- Use correlation IDs for distributed tracing

---

### 18. **Prisma Query Logging in Development**
**Location:** `src/lib/db.ts:10`  
**Severity:** MEDIUM  
**Risk:** Query logging in development could accidentally expose sensitive queries in production if misconfigured.

**Recommendation:**
- Ensure `NODE_ENV` is properly set in production
- Consider using a more explicit environment variable
- Add additional checks to prevent logging in production

---

### 19. **No Database Connection Pooling Limits**
**Location:** `src/lib/db.ts`  
**Severity:** MEDIUM  
**Risk:** Unbounded database connections could exhaust database resources.

**Recommendation:**
- Configure Prisma connection pool limits
- Set appropriate `connection_limit` in `DATABASE_URL` or Prisma schema

**Fix:**
```typescript
export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  datasources: {
    db: {
      url: env.DATABASE_URL + '?connection_limit=10&pool_timeout=20',
    },
  },
});
```

---

### 20. **No HTTPS Enforcement**
**Location:** Application configuration  
**Severity:** MEDIUM  
**Risk:** In production, HTTP should be redirected to HTTPS to protect credentials and tokens.

**Recommendation:**
- Configure HTTPS redirect in production
- Use Next.js middleware or reverse proxy (nginx/traefik)
- Set `NEXTAUTH_URL` to HTTPS in production

---

## 🟢 LOW PRIORITY / BEST PRACTICES

### 21. **Missing Content Security Policy**
**Location:** `next.config.ts`  
**Severity:** LOW  
**Risk:** CSP helps prevent XSS attacks. Current implementation lacks comprehensive CSP.

**Recommendation:**
- Implement strict Content Security Policy
- Gradually tighten CSP rules
- Use CSP reporting to identify violations

---

### 22. **No API Versioning**
**Location:** API routes  
**Severity:** LOW  
**Risk:** Future API changes could break clients.

**Recommendation:**
- Consider API versioning (`/api/v1/...`)
- Plan for backward compatibility

---

### 23. **Missing Health Check Authentication**
**Location:** `src/app/api/health/route.ts`  
**Severity:** LOW  
**Risk:** Health check endpoint might expose sensitive system information.

**Recommendation:**
- Keep health checks minimal
- Don't expose detailed system information
- Consider basic authentication for health checks in production

---

## ✅ POSITIVE SECURITY FINDINGS

1. **Prisma ORM Usage** - Protects against SQL injection through parameterized queries
2. **RBAC Implementation** - Proper role-based access control system in place
3. **Audit Logging** - Comprehensive audit trail for security events
4. **Authorization Checks** - Most routes properly check permissions
5. **No XSS Vulnerabilities Found** - No use of `dangerouslySetInnerHTML` or `eval`
6. **Environment Variable Validation** - `env.ts` validates required variables
7. **Transaction Usage** - Critical operations use database transactions
8. **Soft Deletes** - Skills are archived rather than hard-deleted

---

## 📋 RECOMMENDED ACTION PLAN

### Immediate (Before Production):
1. ✅ Replace SHA-256 with bcrypt/argon2
2. ✅ Remove hardcoded secrets
3. ✅ Implement rate limiting on auth endpoints
4. ✅ Add input validation (Zod)
5. ✅ Move JWT tokens to httpOnly cookies
6. ✅ Add security headers
7. ✅ Implement CSRF protection

### Short-term (Within 1-2 weeks):
8. ✅ Replace in-memory rate limiting with Redis
9. ✅ Add password strength requirements
10. ✅ Move database credentials to environment variables
11. ✅ Add request size limits
12. ✅ Sanitize MCP tool input
13. ✅ Implement refresh tokens

### Medium-term (Within 1 month):
14. ✅ Fix audit logging system user creation
15. ✅ Add CORS configuration
16. ✅ Improve error message handling
17. ✅ Add request ID tracking
18. ✅ Configure database connection pooling

---

## 🔧 QUICK WINS

These can be implemented quickly with high security impact:

1. **Add security headers** (15 minutes)
2. **Remove hardcoded secret fallback** (5 minutes)
3. **Add request size limits** (10 minutes)
4. **Improve error messages** (30 minutes)
5. **Add CORS configuration** (15 minutes)

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

## 📝 NOTES

- This audit focused on code-level security. Infrastructure security (server hardening, network security, etc.) should be audited separately.
- Consider engaging a professional security firm for penetration testing before production deployment.
- Regular security audits should be conducted quarterly or after major changes.

---

**Report Generated:** February 1, 2026  
**Next Review:** Recommended after implementing critical fixes
