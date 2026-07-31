/*
  Warnings:

  - A unique constraint covering the columns `[emergencyFundId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "emergencyFundId" TEXT,
ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_emergencyFundId_key" ON "Transaction"("emergencyFundId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_emergencyFundId_fkey" FOREIGN KEY ("emergencyFundId") REFERENCES "EmergencyFund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "ReccuringExpenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
