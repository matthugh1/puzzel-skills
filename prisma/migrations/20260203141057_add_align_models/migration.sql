-- CreateEnum
CREATE TYPE "AlignmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('IDEA', 'PRIORITIZED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "CoalitionRole" AS ENUM ('SPONSOR', 'LEAD', 'CHAMPION', 'IT', 'SECURITY', 'LND');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('READY', 'RUNNING', 'DISABLED');

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "agentId" TEXT;

-- CreateTable
CREATE TABLE "alignment_snapshots" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "AlignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alignment_opportunities" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "valueScore" INTEGER NOT NULL,
    "feasibilityScore" INTEGER NOT NULL,
    "timeToPilotWeeks" INTEGER,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'IDEA',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alignment_roadmap_items" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "targetQuarter" TEXT,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'PLANNED',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_roadmap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alignment_coalition_members" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CoalitionRole" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_coalition_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alignment_guardrails" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "allowedCategories" TEXT[],
    "blockedCategories" TEXT[],
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alignment_guardrails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'READY',
    "config" JSONB,
    "ownerId" TEXT NOT NULL,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alignment_snapshots_ownerId_idx" ON "alignment_snapshots"("ownerId");

-- CreateIndex
CREATE INDEX "alignment_snapshots_status_idx" ON "alignment_snapshots"("status");

-- CreateIndex
CREATE INDEX "alignment_opportunities_snapshotId_idx" ON "alignment_opportunities"("snapshotId");

-- CreateIndex
CREATE INDEX "alignment_opportunities_status_idx" ON "alignment_opportunities"("status");

-- CreateIndex
CREATE INDEX "alignment_opportunities_department_idx" ON "alignment_opportunities"("department");

-- CreateIndex
CREATE INDEX "alignment_opportunities_ownerId_idx" ON "alignment_opportunities"("ownerId");

-- CreateIndex
CREATE INDEX "alignment_roadmap_items_snapshotId_idx" ON "alignment_roadmap_items"("snapshotId");

-- CreateIndex
CREATE INDEX "alignment_roadmap_items_status_idx" ON "alignment_roadmap_items"("status");

-- CreateIndex
CREATE INDEX "alignment_roadmap_items_priority_idx" ON "alignment_roadmap_items"("priority");

-- CreateIndex
CREATE INDEX "alignment_roadmap_items_ownerId_idx" ON "alignment_roadmap_items"("ownerId");

-- CreateIndex
CREATE INDEX "alignment_coalition_members_snapshotId_idx" ON "alignment_coalition_members"("snapshotId");

-- CreateIndex
CREATE INDEX "alignment_coalition_members_role_idx" ON "alignment_coalition_members"("role");

-- CreateIndex
CREATE INDEX "alignment_coalition_members_userId_idx" ON "alignment_coalition_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "alignment_coalition_members_snapshotId_userId_role_key" ON "alignment_coalition_members"("snapshotId", "userId", "role");

-- CreateIndex
CREATE INDEX "alignment_guardrails_snapshotId_idx" ON "alignment_guardrails"("snapshotId");

-- CreateIndex
CREATE INDEX "alignment_guardrails_createdById_idx" ON "alignment_guardrails"("createdById");

-- CreateIndex
CREATE INDEX "agents_ownerId_idx" ON "agents"("ownerId");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- AddForeignKey
ALTER TABLE "alignment_snapshots" ADD CONSTRAINT "alignment_snapshots_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_opportunities" ADD CONSTRAINT "alignment_opportunities_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "alignment_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_opportunities" ADD CONSTRAINT "alignment_opportunities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_roadmap_items" ADD CONSTRAINT "alignment_roadmap_items_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "alignment_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_roadmap_items" ADD CONSTRAINT "alignment_roadmap_items_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "alignment_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_roadmap_items" ADD CONSTRAINT "alignment_roadmap_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_coalition_members" ADD CONSTRAINT "alignment_coalition_members_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "alignment_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_coalition_members" ADD CONSTRAINT "alignment_coalition_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_guardrails" ADD CONSTRAINT "alignment_guardrails_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "alignment_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alignment_guardrails" ADD CONSTRAINT "alignment_guardrails_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
