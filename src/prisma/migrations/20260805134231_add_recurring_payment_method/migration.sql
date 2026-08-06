-- AlterTable
ALTER TABLE "ReccuringExpenses" ADD COLUMN     "paymentMethodId" TEXT;

-- AddForeignKey
ALTER TABLE "ReccuringExpenses" ADD CONSTRAINT "ReccuringExpenses_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
