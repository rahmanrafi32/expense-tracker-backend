/*
  Warnings:

  - A unique constraint covering the columns `[sourceTransactionId]` on the table `AllocationBatch` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AllocationBatch" ADD COLUMN     "sourceTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AllocationBatch_sourceTransactionId_key" ON "AllocationBatch"("sourceTransactionId");

-- AddForeignKey
ALTER TABLE "AllocationBatch" ADD CONSTRAINT "AllocationBatch_sourceTransactionId_fkey" FOREIGN KEY ("sourceTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
