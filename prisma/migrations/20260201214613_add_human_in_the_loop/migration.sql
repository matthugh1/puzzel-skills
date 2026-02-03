-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "DataInputStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "PathSelectionStatus" AS ENUM ('PENDING', 'SELECTED', 'CANCELLED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "run_tasks" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_input_requests" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" "DataInputStatus" NOT NULL DEFAULT 'PENDING',
    "submittedData" JSONB,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_input_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_paths" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "branchStepId" TEXT NOT NULL,
    "pathOptions" JSONB NOT NULL,
    "status" "PathSelectionStatus" NOT NULL DEFAULT 'PENDING',
    "selectedPath" TEXT,
    "selectedBy" TEXT,
    "selectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "timeoutAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_paths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_tasks_runId_idx" ON "run_tasks"("runId");

-- CreateIndex
CREATE INDEX "run_tasks_assigneeId_idx" ON "run_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "run_tasks_status_idx" ON "run_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "run_tasks_runId_stepIndex_key" ON "run_tasks"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "data_input_requests_runId_idx" ON "data_input_requests"("runId");

-- CreateIndex
CREATE INDEX "data_input_requests_assigneeId_idx" ON "data_input_requests"("assigneeId");

-- CreateIndex
CREATE INDEX "data_input_requests_status_idx" ON "data_input_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "data_input_requests_runId_stepIndex_key" ON "data_input_requests"("runId", "stepIndex");

-- CreateIndex
CREATE INDEX "run_paths_runId_idx" ON "run_paths"("runId");

-- CreateIndex
CREATE INDEX "run_paths_status_idx" ON "run_paths"("status");

-- CreateIndex
CREATE UNIQUE INDEX "run_paths_runId_stepIndex_key" ON "run_paths"("runId", "stepIndex");

-- AddForeignKey
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_input_requests" ADD CONSTRAINT "data_input_requests_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_input_requests" ADD CONSTRAINT "data_input_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_input_requests" ADD CONSTRAINT "data_input_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_paths" ADD CONSTRAINT "run_paths_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_paths" ADD CONSTRAINT "run_paths_selectedBy_fkey" FOREIGN KEY ("selectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
