-- CreateEnum
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "department_workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "department_workspaces_slug_key" ON "department_workspaces"("slug");

-- CreateIndex
CREATE INDEX "department_workspaces_ownerId_idx" ON "department_workspaces"("ownerId");

-- CreateIndex
CREATE INDEX "department_workspaces_slug_idx" ON "department_workspaces"("slug");

-- CreateIndex
CREATE INDEX "department_workspaces_isActive_idx" ON "department_workspaces"("isActive");

-- CreateIndex
CREATE INDEX "department_workspace_members_workspaceId_idx" ON "department_workspace_members"("workspaceId");

-- CreateIndex
CREATE INDEX "department_workspace_members_userId_idx" ON "department_workspace_members"("userId");

-- CreateIndex
CREATE INDEX "department_workspace_members_role_idx" ON "department_workspace_members"("role");

-- CreateIndex
CREATE UNIQUE INDEX "department_workspace_members_workspaceId_userId_key" ON "department_workspace_members"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "department_workspaces" ADD CONSTRAINT "department_workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_workspace_members" ADD CONSTRAINT "department_workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "department_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_workspace_members" ADD CONSTRAINT "department_workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
