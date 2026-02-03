-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTING', 'CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "app_integrations" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTING',
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_actions" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "description" TEXT,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "requiresAuth" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_integrations_userId_idx" ON "app_integrations"("userId");

-- CreateIndex
CREATE INDEX "app_integrations_appName_idx" ON "app_integrations"("appName");

-- CreateIndex
CREATE INDEX "app_integrations_status_idx" ON "app_integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "app_integrations_userId_appName_key" ON "app_integrations"("userId", "appName");

-- CreateIndex
CREATE INDEX "app_actions_appName_idx" ON "app_actions"("appName");

-- CreateIndex
CREATE UNIQUE INDEX "app_actions_appName_actionName_key" ON "app_actions"("appName", "actionName");

-- AddForeignKey
ALTER TABLE "app_integrations" ADD CONSTRAINT "app_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
