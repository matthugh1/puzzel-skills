# JOB-12: Admin Panel UI

## Objective
Create an admin interface for managing users, roles, and system settings.

---

## Features

### 1. User Management (`/admin/users`)
- List all users
- Search by name/email
- Filter by role
- Edit user roles
- Deactivate/reactivate users

### 2. Role Management (`/admin/roles`)
- View roles and their permissions
- (Future) Create custom roles
- Assign permissions to roles

### 3. Category Management (`/admin/categories`)
- List categories
- Add/edit/delete categories
- Reorder categories

### 4. System Overview (`/admin`)
- Dashboard with stats:
  - Total skills (by status)
  - Total users (by role)
  - Pending approvals count
  - Recent activity

### 5. Audit Log Viewer (`/admin/audit`)
- Searchable audit log
- Filter by action, user, entity
- Date range filter
- Export to CSV

---

## Files to Create

```
src/app/
├── admin/
│   ├── page.tsx              # Admin dashboard
│   ├── layout.tsx            # Admin layout with sidebar
│   ├── users/
│   │   ├── page.tsx          # User list
│   │   └── [id]/
│   │       └── page.tsx      # Edit user
│   ├── roles/
│   │   └── page.tsx          # Role management
│   ├── categories/
│   │   └── page.tsx          # Category management
│   └── audit/
│       └── page.tsx          # Audit log viewer
src/components/
├── admin/
│   ├── AdminSidebar.tsx      # Navigation sidebar
│   ├── StatsCard.tsx         # Dashboard stat card
│   ├── UserTable.tsx         # User list table
│   ├── RoleEditor.tsx        # Role/permission editor
│   ├── CategoryList.tsx      # Category management
│   └── AuditLogTable.tsx     # Audit log display
```

---

## Access Control

Admin panel requires `users:admin` permission (admin role only).

Middleware should check permission before rendering any admin page.

---

## Dashboard Stats

```typescript
interface DashboardStats {
  skills: {
    total: number;
    draft: number;
    pending: number;
    published: number;
    archived: number;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  approvals: {
    pending: number;
    approvedThisWeek: number;
    rejectedThisWeek: number;
  };
  recentActivity: AuditLog[];
}
```

---

## Acceptance Criteria

- [ ] Dashboard shows system overview stats
- [ ] Admin can view all users
- [ ] Admin can change user roles
- [ ] Admin can deactivate users
- [ ] Category CRUD works correctly
- [ ] Audit log is searchable and filterable
- [ ] All admin pages require admin role
- [ ] Responsive design
