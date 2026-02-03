# Repository Contract

This document defines the non-negotiable constraints, patterns, and "do not modify" rules for the Skills Library codebase. All code changes must adhere to this contract.

## Skills System

### Location
- Skills are stored in `.cursor/skills/` directory
- Each skill is a subdirectory with a `SKILL.md` file
- Example: `.cursor/skills/api-route-development/SKILL.md`

### Skill File Format
- **Format**: Markdown with YAML frontmatter
- **Required frontmatter**:
  ```yaml
  ---
  name: skill-name-kebab-case
  description: One-line description of when to use this skill
  ---
  ```
- **Content**: Markdown instructions with code examples, patterns, and verification steps

### Skill Categories
Skills are organized by category (directory name):
- `api-route-development` - API route patterns
- `database-schema-development` - Prisma schema conventions
- `code-style-conventions` - TypeScript/style patterns
- `ui-component-development` - React/UI patterns
- `authentication-security` - Auth patterns
- `security-best-practices` - Security requirements
- `deployment-security` - Deployment security
- `git-commit-messages` - Commit message format

## Code Conventions

### Prisma Schema
- **Location**: `prisma/schema.prisma`
- **Naming**:
  - Models: PascalCase (e.g., `User`, `Skill`, `SkillVersion`)
  - Tables: snake_case via `@@map()` (e.g., `@@map("users")`)
  - Fields: camelCase (e.g., `ownerId`, `createdAt`)
- **Required fields**: All models must have:
  - `id String @id @default(cuid())` - Never use auto-increment integers
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt` (if model is mutable)
- **Special field names**:
  - Use `changeNotes` (not `changelog` or `changeLog`)
  - Use `rejectionReason` (not `rejection_message` or `reason`)

### API Routes (Next.js App Router)
- **Location**: `src/app/api/`
- **Pattern**: Must follow this exact order:
  1. CSRF protection (if POST/PUT/DELETE)
  2. Authentication & Authorization (`checkAuthWithPermission`)
  3. Rate limiting (`rateLimit`)
  4. Input validation (`validateRequestBody` with Zod schemas)
  5. Business logic
  6. Audit logging (`audit.actionName`)
  7. Response (`NextResponse.json()`)
- **Required imports**:
  ```typescript
  import { NextResponse } from 'next/server';
  import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
  import { audit } from '@/lib/audit';
  import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
  import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
  ```
- **Error handling**: Always use try/catch, return generic error messages
- **Status codes**: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)

### Path Aliases
- **Always use `@/` prefix** for imports
- Never use relative paths (`../../`)
- Common paths:
  - `@/lib/*` - Utility libraries
  - `@/components/*` - React components
  - `@/types` - TypeScript types
  - `@/app/*` - Next.js app directory (rarely imported)

### Runtime Libraries
- **Location**: `src/lib/`
- **Pattern**: Export singleton instances or utility functions
- **Examples**:
  - `src/lib/db.ts` - Prisma client singleton
  - `src/lib/audit.ts` - Audit logging service
  - `src/lib/permissions.ts` - RBAC utilities
- **Naming**: Use descriptive names, export as named exports

### Audit Logging
- **Pattern**: `audit.actionName(resourceId, userId, metadata?, request?)`
- **Resource types**: `'skill' | 'version' | 'user' | 'auth' | 'mcp' | 'agent'`
- **Actions**: Use dot notation (e.g., `skill.created`, `agent.run.completed`)
- **Always pass request object** for IP address and user agent capture

### Permissions
- **Pattern**: `PERMISSIONS.ACTION_RESOURCE` (e.g., `PERMISSIONS.SKILLS_CREATE`)
- **Location**: `src/lib/permissions.ts`
- **Seed data**: Add permissions in `prisma/seed.ts` using `upsert` pattern

### Database Migrations
- **Location**: `prisma/migrations/` (auto-generated)
- **Commands**: `npx prisma migrate dev --name migration-name`
- **Seed updates**: Update `prisma/seed.ts` for new permissions/roles/data

### UI Components
- **Location**: `src/components/` and `src/app/`
- **Design system**: Puzzel Nordic Design System
- **Rules**:
  - White backgrounds only (`var(--color-background)`)
  - Dark text (`var(--color-text)`)
  - Purple accents (`var(--color-primary)`)
  - Height-constrained pages (`max-height: 100vh`)
  - Use CSS variables, never hardcoded colors
- **Page layout**: Use `.page-container`, `.page-header`, `.page-content` classes

## Do Not Modify (Strict Prohibition)

### Database Schema
- **DO NOT modify `Skill` model** - No field additions, removals, or type changes
- **DO NOT modify `SkillVersion` model** - No field additions, removals, or type changes
- **DO NOT add relations to `Skill` or `SkillVersion`** - Use separate tables (e.g., `SkillVersionMetadata`) instead
- **Rationale**: These models are core to the system and changing them breaks existing functionality

### MCP Execution
- **DO NOT modify `/api/mcp` handler behavior** - Single-step execution must remain unchanged
- **DO NOT change `tools/call` response format** - Must return merged prompt text
- **Rationale**: MCP protocol compatibility must be maintained

### Core Auth/RBAC
- **DO NOT modify `checkAuthWithPermission` signature** - Extend permissions, don't change the function
- **DO NOT modify `AuditLog` model structure** - Extend `ResourceType` enum, don't change fields

## Dependency Policy

### Minimal Dependencies
- **Principle**: Only add dependencies that are already in the project
- **Check `package.json`** before proposing new packages
- **Existing packages**:
  - `@prisma/client` - Database ORM
  - `zod` - Validation
  - `jose` - JWT
  - `bcryptjs` - Password hashing
  - `next`, `react`, `react-dom` - Framework
  - `tailwindcss` - Styling

### Adding New Dependencies
- **Requires justification**: Why can't existing packages be used?
- **Security review**: Check for known vulnerabilities
- **Size impact**: Consider bundle size for frontend packages

## Error Handling Patterns

### API Routes
```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: 'Invalid request data', details: error.errors },
      { status: 400 }
    );
  }
  console.error('Operation error:', error);
  return NextResponse.json(
    { error: 'Descriptive generic message' },
    { status: 500 }
  );
}
```

### Generic Error Messages
- **Never leak sensitive information**
- Use generic messages: "Invalid credentials" not "User not found"
- Log detailed errors server-side only (`console.error`)

## Transaction Handling

### Pattern
```typescript
const result = await db.$transaction(async (tx) => {
  // Multiple operations
  const updated = await tx.model.update({ ... });
  await tx.otherModel.create({ ... });
  return updated;
});
```

### When to Use
- Multiple related database operations that must succeed/fail together
- Updates that depend on each other
- Preventing race conditions

## Testing Patterns

### Integration Tests
- **Location**: `__tests__/` or `tests/` directory (if exists)
- **Pattern**: Test API routes end-to-end
- **Database**: Use test database or mocks

### Manual Testing
- **Default admin**: `admin@puzzel.com` / `admin123`
- **Seed data**: Run `pnpm db:seed` to reset test data

## Git Commit Messages

### Format
Use conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `chore:` - Maintenance

## Verification Checklist

Before submitting code:

### Database Changes
- [ ] No modifications to `Skill` or `SkillVersion` models
- [ ] New models follow naming conventions (PascalCase, snake_case tables)
- [ ] All models have `id`, `createdAt`, `updatedAt`
- [ ] Migration generated and tested
- [ ] Seed script updated if needed

### API Routes
- [ ] Follows required pattern (CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response)
- [ ] Uses `checkAuthWithPermission` for protected routes
- [ ] Uses `NextResponse.json()` for responses
- [ ] Generic error messages (no information leakage)
- [ ] Audit logging for create/update/delete operations

### Code Style
- [ ] Uses `@/` path aliases (no relative paths)
- [ ] Uses async/await (no `.then()` chains)
- [ ] TypeScript strict mode compliant
- [ ] Error handling with try/catch

### Security
- [ ] Input validation with Zod schemas
- [ ] Rate limiting applied
- [ ] No SQL injection vulnerabilities
- [ ] No passwords in logs or responses

---

**Last Updated**: 2026-02-01  
**Maintained By**: Skills Library Team
