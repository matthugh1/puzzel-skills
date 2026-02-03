/**
 * Shared types for Skills Library
 * Will be expanded in subsequent jobs
 */

export type SkillStatus = 'draft' | 'pending_approval' | 'published' | 'archived';

export type VersionStatus = 'draft' | 'pending_approval' | 'published' | 'rejected';

export type UserRole = 'viewer' | 'creator' | 'approver' | 'admin';

export type Permission =
  | 'skills:read'
  | 'skills:create'
  | 'skills:update'
  | 'skills:delete'
  | 'skills:approve'
  | 'skills:admin'
  | 'users:read'
  | 'users:admin'
  | 'audit:read';
