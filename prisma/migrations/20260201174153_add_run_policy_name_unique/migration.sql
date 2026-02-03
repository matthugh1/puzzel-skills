/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `run_policies` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "run_policies_name_key" ON "run_policies"("name");
