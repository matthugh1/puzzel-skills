import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { validatePasswordStrength } from '../src/lib/password';

const prisma = new PrismaClient();

// Use bcrypt for password hashing (same as production)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@puzzel.com';
  const adminName = process.env.ADMIN_NAME ?? 'Admin';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is required to seed the admin user.');
  }

  const passwordValidation = validatePasswordStrength(adminPassword);
  if (!passwordValidation.valid) {
    throw new Error(`ADMIN_PASSWORD does not meet requirements: ${passwordValidation.errors.join(' ')}`);
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================
  console.log('Creating permissions...');

  const permissions = [
    { name: 'skills:read', description: 'View published skills' },
    { name: 'skills:create', description: 'Create new skills' },
    { name: 'skills:update', description: 'Update own skills' },
    { name: 'skills:delete', description: 'Delete own skills' },
    { name: 'skills:approve', description: 'Approve or reject skill submissions' },
    { name: 'skills:admin', description: 'Manage all skills' },
    { name: 'users:read', description: 'View users' },
    { name: 'users:admin', description: 'Manage users and roles' },
    { name: 'audit:read', description: 'View audit logs' },
    { name: 'runs:approve', description: 'Approve or reject agent runs' },
    { name: 'workflows:create', description: 'Create workflows' },
    { name: 'workflows:read', description: 'View workflows' },
    { name: 'workflows:update', description: 'Update workflows' },
    { name: 'workflows:delete', description: 'Delete workflows' },
    { name: 'align:read', description: 'View alignment snapshots and artifacts' },
    { name: 'align:write', description: 'Create and update alignment data' },
    { name: 'align:admin', description: 'Manage alignment settings and access' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // ============================================================================
  // ROLES
  // ============================================================================
  console.log('Creating roles...');

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Can view and use published skills',
    },
  });

  const creatorRole = await prisma.role.upsert({
    where: { name: 'creator' },
    update: {},
    create: {
      name: 'creator',
      description: 'Can create skills and submit for approval',
    },
  });

  const approverRole = await prisma.role.upsert({
    where: { name: 'approver' },
    update: {},
    create: {
      name: 'approver',
      description: 'Can approve or reject skill submissions',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Full access to all features',
    },
  });

  // ============================================================================
  // ROLE-PERMISSION MAPPINGS
  // ============================================================================
  console.log('Assigning permissions to roles...');

  const rolePermissions: Record<string, string[]> = {
    viewer: ['skills:read', 'workflows:read', 'align:read'],
    creator: [
      'skills:read',
      'skills:create',
      'skills:update',
      'skills:delete',
      'workflows:read',
      'workflows:create',
      'workflows:update',
      'workflows:delete',
      'align:read',
      'align:write',
    ],
    approver: [
      'skills:read',
      'skills:create',
      'skills:update',
      'skills:delete',
      'skills:approve',
      'users:read',
      'audit:read',
      'runs:approve',
      'workflows:read',
      'workflows:create',
      'workflows:update',
      'workflows:delete',
      'align:read',
      'align:write',
    ],
    admin: [
      'skills:read',
      'skills:create',
      'skills:update',
      'skills:delete',
      'skills:approve',
      'skills:admin',
      'users:read',
      'users:admin',
      'audit:read',
      'runs:approve',
      'workflows:read',
      'workflows:create',
      'workflows:update',
      'workflows:delete',
      'align:read',
      'align:write',
      'align:admin',
    ],
  };

  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    for (const permName of permNames) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      });
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // ============================================================================
  // DEFAULT ADMIN USER
  // ============================================================================
  console.log('Creating default admin user...');

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: await hashPassword(adminPassword),
    },
    create: {
      email: adminEmail,
      name: adminName,
      authProvider: 'LOCAL',
      passwordHash: await hashPassword(adminPassword),
    },
  });

  // Assign admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // ============================================================================
  // SYSTEM USER (for audit logging)
  // ============================================================================
  console.log('Creating system user for audit logging...');

  await prisma.user.upsert({
    where: { email: 'system@internal' },
    update: {},
    create: {
      email: 'system@internal',
      name: 'System',
      authProvider: 'LOCAL',
      // No password - this user cannot log in
    },
  });

  // ============================================================================
  // DEFAULT RUN POLICY
  // ============================================================================
  console.log('Creating default run policy...');

  let defaultPolicy = await prisma.runPolicy.findFirst({
    where: { name: 'default' },
  });

  if (!defaultPolicy) {
    defaultPolicy = await prisma.runPolicy.create({
      data: {
        name: 'default',
        description: 'Default policy for agent runs',
        maxSteps: 10,
        maxRetriesPerStep: 3,
        maxDurationSeconds: 3600,
        requiresApproval: false,
        allowedCategories: [],
        blockedCategories: [],
        allowedCapabilities: [],
        blockedCapabilities: [],
        allowedTags: [],
        blockedTags: [],
        maxArtefactsPerRun: 100,
        maxInitialContextBytes: 100000,
        createdById: adminUser.id,
      },
    });
  }

  // ============================================================================
  // SAMPLE SKILL (for testing)
  // ============================================================================
  console.log('Creating sample skill...');

  const sampleSkill = await prisma.skill.upsert({
    where: { id: 'sample-contract-analyzer' },
    update: {},
    create: {
      id: 'sample-contract-analyzer',
      name: 'Contract Red Flags Analyzer',
      description:
        'Analyzes contracts for risks, unfavorable terms, and potential red flags.',
      category: 'Legal',
      tags: ['contracts', 'legal', 'risk', 'compliance'],
      status: 'PUBLISHED',
      visibility: 'ORG',
      ownerId: adminUser.id,
    },
  });

  await prisma.skillVersion.upsert({
    where: {
      skillId_version: {
        skillId: sampleSkill.id,
        version: 1,
      },
    },
    update: {},
    create: {
      skillId: sampleSkill.id,
      version: 1,
      content: `You are an expert contract analyst specializing in identifying risks, unfavorable terms, and potential red flags in commercial agreements.

## Contract Types You Analyze
1. Master Services Agreements (MSAs)
2. Employment Contracts
3. Sales Agreements
4. NDAs & Confidentiality
5. Partnership Agreements

## Red Flag Categories
- Financial Risks (liability caps, indemnification, penalties)
- Termination & Lock-in (term length, auto-renewal, fees)
- Intellectual Property (assignment, licensing)
- Data & Privacy (ownership, transfers, breach notification)
- Service Levels & Remedies (SLAs, credits, exclusions)

## Risk Severity Classification
- CRITICAL: Immediate significant exposure
- HIGH: Material financial risk
- MEDIUM: Notable concern, should negotiate
- LOW: Minor issue, worth noting
- INFO: Neutral observation

Provide analysis with score (0-100), findings, violations, and recommendations.`,
      changeNotes: 'Initial version',
      status: 'PUBLISHED',
      createdById: adminUser.id,
      approvedById: adminUser.id,
      approvedAt: new Date(),
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log('');
  console.log('Default admin user updated.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
