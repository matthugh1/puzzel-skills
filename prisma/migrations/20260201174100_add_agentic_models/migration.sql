-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'AZURE');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('TEAM', 'ORG');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PLANNING', 'RUNNING', 'BLOCKED', 'COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'FAILED_STALE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ArtefactType" AS ENUM ('PROMPT_OUTPUT', 'FILE_DIFF', 'CODE_CHANGE', 'DECISION_LOG', 'ERROR', 'EXECUTOR_OUTPUT', 'TOOL_REQUEST');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "externalId" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SkillStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "Visibility" NOT NULL DEFAULT 'ORG',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changeNotes" TEXT,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "skillId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxSteps" INTEGER NOT NULL,
    "maxRetriesPerStep" INTEGER NOT NULL DEFAULT 3,
    "maxDurationSeconds" INTEGER NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "allowedCategories" TEXT[],
    "blockedCategories" TEXT[],
    "allowedCapabilities" TEXT[],
    "blockedCapabilities" TEXT[],
    "allowedTags" TEXT[],
    "blockedTags" TEXT[],
    "maxDiffBudget" INTEGER,
    "maxArtefactsPerRun" INTEGER NOT NULL DEFAULT 100,
    "maxInitialContextBytes" INTEGER NOT NULL DEFAULT 100000,
    "environmentRestrictions" JSONB,
    "governanceRules" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PLANNING',
    "goal" TEXT NOT NULL,
    "initialContext" JSONB NOT NULL,
    "initialContextRedacted" BOOLEAN NOT NULL DEFAULT false,
    "inputAllowlist" JSONB,
    "policyId" TEXT,
    "plan" JSONB,
    "planContentHash" TEXT,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "blockedReason" TEXT,
    "idempotencyKey" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "maxDurationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_steps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "skillId" TEXT NOT NULL,
    "skillVersionId" TEXT NOT NULL,
    "skillVersionContentHash" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "inputContext" JSONB NOT NULL,
    "outputContext" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_artefacts" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "ArtefactType" NOT NULL,
    "content" JSONB NOT NULL,
    "contentRedacted" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "Sensitivity" NOT NULL,
    "retentionExpiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_artefacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_approvals" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "reason" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "run_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_version_metadata" (
    "id" TEXT NOT NULL,
    "skillVersionId" TEXT NOT NULL,
    "outputContract" JSONB,
    "capabilities" TEXT[],
    "preferredInputs" JSONB,
    "maxRetries" INTEGER,
    "timeoutSeconds" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "executorConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_version_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "skills_ownerId_idx" ON "skills"("ownerId");

-- CreateIndex
CREATE INDEX "skills_category_idx" ON "skills"("category");

-- CreateIndex
CREATE INDEX "skills_status_idx" ON "skills"("status");

-- CreateIndex
CREATE INDEX "skill_versions_skillId_idx" ON "skill_versions"("skillId");

-- CreateIndex
CREATE INDEX "skill_versions_status_idx" ON "skill_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "skill_versions_skillId_version_key" ON "skill_versions"("skillId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_idempotencyKey_key" ON "agent_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agent_runs_userId_idx" ON "agent_runs"("userId");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_runs_idempotencyKey_idx" ON "agent_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agent_runs_leaseOwner_idx" ON "agent_runs"("leaseOwner");

-- CreateIndex
CREATE INDEX "run_steps_runId_idx" ON "run_steps"("runId");

-- CreateIndex
CREATE INDEX "run_steps_skillVersionId_idx" ON "run_steps"("skillVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "run_steps_runId_stepIndex_key" ON "run_steps"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "run_artefacts_runId_idx" ON "run_artefacts"("runId");

-- CreateIndex
CREATE INDEX "run_artefacts_stepId_idx" ON "run_artefacts"("stepId");

-- CreateIndex
CREATE INDEX "run_artefacts_type_idx" ON "run_artefacts"("type");

-- CreateIndex
CREATE INDEX "run_artefacts_sensitivity_idx" ON "run_artefacts"("sensitivity");

-- CreateIndex
CREATE INDEX "run_approvals_runId_idx" ON "run_approvals"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_version_metadata_skillVersionId_key" ON "skill_version_metadata"("skillVersionId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_resourceId_idx" ON "audit_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_policies" ADD CONSTRAINT "run_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "run_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "skill_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_artefacts" ADD CONSTRAINT "run_artefacts_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "run_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_artefacts" ADD CONSTRAINT "run_artefacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_approvals" ADD CONSTRAINT "run_approvals_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_approvals" ADD CONSTRAINT "run_approvals_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_approvals" ADD CONSTRAINT "run_approvals_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_version_metadata" ADD CONSTRAINT "skill_version_metadata_skillVersionId_fkey" FOREIGN KEY ("skillVersionId") REFERENCES "skill_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
