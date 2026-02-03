-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('VIEWER', 'EDITOR');

-- CreateTable
CREATE TABLE "workflow_shares" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEWER',
    "sharedBy" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_shares_workflowId_idx" ON "workflow_shares"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_shares_userId_idx" ON "workflow_shares"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_shares_workflowId_userId_key" ON "workflow_shares"("workflowId", "userId");

-- AddForeignKey
ALTER TABLE "workflow_shares" ADD CONSTRAINT "workflow_shares_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_shares" ADD CONSTRAINT "workflow_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_shares" ADD CONSTRAINT "workflow_shares_sharedBy_fkey" FOREIGN KEY ("sharedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
