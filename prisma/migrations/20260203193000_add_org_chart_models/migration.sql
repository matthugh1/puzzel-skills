-- CreateEnum
CREATE TYPE "OrgNodeType" AS ENUM ('DEPARTMENT', 'TEAM', 'AGENT');

-- CreateTable
CREATE TABLE "org_charts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'ORG',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_nodes" (
    "id" TEXT NOT NULL,
    "chartId" TEXT NOT NULL,
    "type" "OrgNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "agentId" TEXT,
    "roleTitle" TEXT,
    "departmentLabel" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_charts_ownerId_idx" ON "org_charts"("ownerId");

-- CreateIndex
CREATE INDEX "org_charts_isDefault_idx" ON "org_charts"("isDefault");

-- CreateIndex
CREATE INDEX "org_nodes_chartId_idx" ON "org_nodes"("chartId");

-- CreateIndex
CREATE INDEX "org_nodes_parentId_idx" ON "org_nodes"("parentId");

-- CreateIndex
CREATE INDEX "org_nodes_type_idx" ON "org_nodes"("type");

-- CreateIndex
CREATE INDEX "org_nodes_agentId_idx" ON "org_nodes"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "org_nodes_chartId_agentId_key" ON "org_nodes"("chartId", "agentId");

-- AddForeignKey
ALTER TABLE "org_charts" ADD CONSTRAINT "org_charts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "org_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
