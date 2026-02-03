-- Remove unintended foreign key constraint
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT IF EXISTS "webhook_endpoints_runPolicyId_fkey";

-- Remove unintended column
ALTER TABLE "webhook_endpoints" DROP COLUMN IF EXISTS "runPolicyId";
