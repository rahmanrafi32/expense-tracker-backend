/*
  Warnings:

  - Added the required column `paymentMethodId` to the `EmergencyFund` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmergencyFund" ADD COLUMN     "paymentMethodId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "EmergencyFund_paymentMethodId_idx" ON "EmergencyFund"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "EmergencyFund" ADD CONSTRAINT "EmergencyFund_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
