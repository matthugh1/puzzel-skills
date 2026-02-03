# JOB-04: Authorization Layer ✅ COMPLETE

## Objective
Implement permission-based authorization middleware for API routes.

---

## Deliverables

- [x] Permission constants
- [x] Route handler wrappers
- [x] Permission checking utilities
- [x] Resource ownership checks

---

## Files Created

```
src/lib/permissions.ts
```

---

## Permission Constants

```typescript
const PERMISSIONS = {
  SKILLS_READ: 'skills:read',
  SKILLS_CREATE: 'skills:create',
  SKILLS_UPDATE: 'skills:update',
  SKILLS_DELETE: 'skills:delete',
  SKILLS_APPROVE: 'skills:approve',
  SKILLS_ADMIN: 'skills:admin',
  USERS_READ: 'users:read',
  USERS_ADMIN: 'users:admin',
  AUDIT_READ: 'audit:read',
};
```

---

## Usage

```typescript
// In API route
export async function GET(request: Request) {
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.SKILLS_READ
  );

  if (!authResult.authorized) {
    return authResult.response; // 401 or 403
  }

  const { user } = authResult;
  // ... proceed with authorized user
}

// Check resource ownership
if (!canModifyResource(user, skill.ownerId)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## Helper Functions

- `checkAuthWithPermission(request, permission)` - Validates token + checks permission
- `canModifyResource(user, ownerId)` - Returns true if user owns resource or is admin
- `isAdmin(user)` - Returns true if user has admin role
- `hasPermission(user, permission)` - Checks if user has specific permission
