-- AlterTable
ALTER TABLE "webhook_endpoints" ADD COLUMN     "runPolicyId" TEXT;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_runPolicyId_fkey" FOREIGN KEY ("runPolicyId") REFERENCES "run_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
