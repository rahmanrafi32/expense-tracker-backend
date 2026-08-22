/*
  Warnings:

  - A unique constraint covering the columns `[recurringExpenseId]` on the table `SinkingFund` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SinkingFund" ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SinkingFund_recurringExpenseId_key" ON "SinkingFund"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "SinkingFund" ADD CONSTRAINT "SinkingFund_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "ReccuringExpenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
