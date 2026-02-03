# JOB-03: Auth Provider ✅ COMPLETE

## Objective
Create a swappable authentication provider abstraction. Start with simple JWT auth, designed to swap for Azure AD later.

---

## Deliverables

- [x] AuthProvider interface
- [x] SimpleAuthProvider (JWT-based)
- [x] Password hashing
- [x] Token generation/validation
- [x] Auth API routes

---

## Files Created

```
src/lib/auth/
├── types.ts          # AuthProvider interface, AuthUser, etc.
├── simple-auth.ts    # JWT implementation
└── index.ts          # Export singleton

src/app/api/auth/
├── login/route.ts    # POST - authenticate
├── logout/route.ts   # POST - revoke token
└── me/route.ts       # GET - current user
```

---

## Interface

```typescript
interface AuthProvider {
  authenticate(credentials: LoginCredentials): Promise<AuthResult>;
  validateToken(token: string): Promise<AuthUser | null>;
  refreshToken(token: string): Promise<string | null>;
  revokeToken(token: string): Promise<void>;
}

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}
```

---

## Usage

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@puzzel.com","password":"admin123"}'

# Response: { user: {...}, token: "eyJ..." }

# Authenticated request
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```
