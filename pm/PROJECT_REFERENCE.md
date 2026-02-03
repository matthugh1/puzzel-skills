# Skills Library - Project Reference

## Vision
A platform for creating, versioning, approving, and sharing AI prompts (skills) across the organization. The "intelligence layer" where prompts are the reusable intelligence, not complex workflow configurations.

## Goals
- Enable business units to be self-sufficient for AI tasks within 12 months
- Proper governance: RBAC, approval workflows, audit trails
- Future Azure AD integration (simple auth for now)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Skills Library                        │
├─────────────────────────────────────────────────────────┤
│  UI Layer (Next.js App Router)                          │
│  ├── Skills Browser                                     │
│  ├── Skill Editor                                       │
│  ├── Approval Dashboard                                 │
│  └── Admin Panel                                        │
├─────────────────────────────────────────────────────────┤
│  API Layer                                              │
│  ├── /api/auth/* - Authentication                       │
│  ├── /api/skills/* - Skills CRUD + Versioning           │
│  ├── /api/users/* - User management                     │
│  └── /api/audit/* - Audit logs                          │
├─────────────────────────────────────────────────────────┤
│  MCP Server                                             │
│  └── Exposes skills to AI agents via MCP protocol       │
├─────────────────────────────────────────────────────────┤
│  Data Layer (Prisma + PostgreSQL)                       │
│  └── Users, Roles, Permissions, Skills, Versions, Audit │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

### Core Entities

**User**
- id, email, name, authProvider, externalId, passwordHash
- Relations: roles, ownedSkills, createdVersions, approvedVersions

**Role** (viewer, creator, approver, admin)
- id, name, description
- Relations: users, permissions

**Permission**
- skills:read, skills:create, skills:update, skills:delete, skills:approve, skills:admin
- users:read, users:admin
- audit:read

**Skill**
- id, name, description, category, tags[], status, visibility, ownerId
- Status: DRAFT | PENDING_APPROVAL | PUBLISHED | ARCHIVED
- Visibility: PRIVATE | TEAM | ORG | PUBLIC

**SkillVersion**
- id, version (int), content (prompt text), changelog, status
- createdById, approvedById, submittedAt, approvedAt, reviewComments
- Status: DRAFT | PENDING_APPROVAL | PUBLISHED | REJECTED

**AuditLog**
- id, action, entityType, entityId, userId, metadata (JSON), createdAt

---

## API Reference

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout (revoke token)
- `GET /api/auth/me` - Get current user

### Skills
- `GET /api/skills` - List skills (filtered by permission)
- `POST /api/skills` - Create skill with initial version
- `GET /api/skills/:id` - Get skill with versions
- `PUT /api/skills/:id` - Update skill metadata
- `DELETE /api/skills/:id` - Archive skill (soft delete)

### Versions
- `GET /api/skills/:id/versions` - List versions
- `POST /api/skills/:id/versions` - Create new version
- `POST /api/skills/:id/submit` - Submit for approval
- `POST /api/skills/:id/approve` - Approve version
- `POST /api/skills/:id/reject` - Reject version

### MCP (Model Context Protocol)
- `tools/list` - List available skills
- `tools/call` - Execute a skill (return prompt)

---

## RBAC Model

| Role     | Permissions                                           |
|----------|-------------------------------------------------------|
| viewer   | skills:read                                           |
| creator  | skills:read, skills:create, skills:update, skills:delete |
| approver | all creator + skills:approve                          |
| admin    | all permissions                                       |

---

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma 5
- **Auth**: JWT (jose library), swappable for Azure AD
- **Styling**: TailwindCSS

---

## Job Status

| Job | Name | Status | Doc |
|-----|------|--------|-----|
| JOB-01 | Project Scaffolding | ✅ Complete | [View](JOB-01_PROJECT_SCAFFOLDING.md) |
| JOB-02 | Database Schema | ✅ Complete | [View](JOB-02_DATABASE_SCHEMA.md) |
| JOB-03 | Auth Provider | ✅ Complete | [View](JOB-03_AUTH_PROVIDER.md) |
| JOB-04 | Authorization Layer | ✅ Complete | [View](JOB-04_AUTHORIZATION_LAYER.md) |
| JOB-05 | Skills CRUD API | ✅ Complete | [View](JOB-05_SKILLS_CRUD_API.md) |
| JOB-06 | Versioning API | ✅ Complete | [View](JOB-06_VERSIONING_API.md) |
| JOB-07 | Approval Workflow API | ✅ Complete | [View](JOB-07_APPROVAL_WORKFLOW_API.md) |
| JOB-08 | MCP Server | 🔲 Pending | [View](JOB-08_MCP_SERVER.md) |
| JOB-09 | Skills Browser UI | 🔲 Pending | [View](JOB-09_SKILLS_BROWSER_UI.md) |
| JOB-10 | Skill Editor UI | 🔲 Pending | [View](JOB-10_SKILL_EDITOR_UI.md) |
| JOB-11 | Approval Dashboard UI | 🔲 Pending | [View](JOB-11_APPROVAL_DASHBOARD_UI.md) |
| JOB-12 | Admin Panel UI | 🔲 Pending | [View](JOB-12_ADMIN_PANEL_UI.md) |
| JOB-13 | Audit Logging | ✅ Complete | [View](JOB-13_AUDIT_LOGGING.md) |

---

## Design System

See [DESIGN_REFERENCE.md](DESIGN_REFERENCE.md) for Puzzel Nordic design guidelines (based on the Product Designer skill you uploaded).
