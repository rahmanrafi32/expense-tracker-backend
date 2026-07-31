-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");
