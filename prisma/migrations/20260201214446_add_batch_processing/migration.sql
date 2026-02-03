-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETE', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "batchIndex" INTEGER;

-- CreateTable
CREATE TABLE "batch_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalItems" INTEGER NOT NULL,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_runs_workflowId_idx" ON "batch_runs"("workflowId");

-- CreateIndex
CREATE INDEX "batch_runs_userId_idx" ON "batch_runs"("userId");

-- CreateIndex
CREATE INDEX "batch_runs_status_idx" ON "batch_runs"("status");

-- CreateIndex
CREATE INDEX "agent_runs_batchId_idx" ON "agent_runs"("batchId");

-- AddForeignKey
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_runs" ADD CONSTRAINT "batch_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batch_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
