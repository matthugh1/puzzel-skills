-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'WEBHOOK', 'SCHEDULED', 'APP_EVENT');

-- CreateEnum
CREATE TYPE "TriggerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "workflowId" TEXT;

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plan" JSONB NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "Visibility" NOT NULL DEFAULT 'ORG',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "triggerType" "TriggerType" NOT NULL,
    "config" JSONB NOT NULL,
    "status" "TriggerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTriggeredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "secret" TEXT,
    "headers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runPolicyId" TEXT,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_ownerId_idx" ON "workflows"("ownerId");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflows_category_idx" ON "workflows"("category");

-- CreateIndex
CREATE INDEX "workflows_visibility_idx" ON "workflows"("visibility");

-- CreateIndex
CREATE INDEX "workflow_triggers_workflowId_idx" ON "workflow_triggers"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_triggers_status_idx" ON "workflow_triggers"("status");

-- CreateIndex
CREATE INDEX "workflow_triggers_triggerType_idx" ON "workflow_triggers"("triggerType");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoints_path_key" ON "webhook_endpoints"("path");

-- CreateIndex
CREATE INDEX "webhook_endpoints_workflowId_idx" ON "webhook_endpoints"("workflowId");

-- CreateIndex
CREATE INDEX "webhook_endpoints_path_idx" ON "webhook_endpoints"("path");

-- CreateIndex
CREATE INDEX "agent_runs_workflowId_idx" ON "agent_runs"("workflowId");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_runPolicyId_fkey" FOREIGN KEY ("runPolicyId") REFERENCES "run_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
