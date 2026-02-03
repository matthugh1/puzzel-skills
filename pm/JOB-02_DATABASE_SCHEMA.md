# JOB-02: Database Schema ✅ COMPLETE

## Objective
Design and implement the RBAC database schema with Users, Roles, Permissions, Skills, and Versions.

---

## Deliverables

- [x] Prisma schema with all models
- [x] RBAC relationships (User → Role → Permission)
- [x] Skills with versioning
- [x] Audit log table
- [x] Seed script with default data

---

## Data Model

### Users & RBAC
```
User (id, email, name, authProvider, externalId, passwordHash)
  └── UserRole → Role (viewer, creator, approver, admin)
                   └── RolePermission → Permission (skills:read, etc.)
```

### Skills & Versions
```
Skill (id, name, description, category, tags[], status, visibility, ownerId)
  └── SkillVersion (version, content, status, createdById, approvedById)
```

### Audit
```
AuditLog (action, entityType, entityId, userId, metadata)
```

---

## Default Seed Data

**Roles:**
- viewer: skills:read
- creator: skills:read, create, update, delete
- approver: all creator + skills:approve
- admin: all permissions

**Default Admin:**
- Email: admin@puzzel.com
- Password: admin123

**Sample Skill:**
- Contract Red Flags Analyzer (Published)
