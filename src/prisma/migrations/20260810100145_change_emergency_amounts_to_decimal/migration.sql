/*
  Warnings:

  - You are about to drop the column `category` on the `EmergencyFund` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `EmergencyFund` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - Added the required column `categoryId` to the `EmergencyFund` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmergencyFund" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- CreateIndex
CREATE INDEX "EmergencyFund_categoryId_idx" ON "EmergencyFund"("categoryId");

-- AddForeignKey
ALTER TABLE "EmergencyFund" ADD CONSTRAINT "EmergencyFund_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
