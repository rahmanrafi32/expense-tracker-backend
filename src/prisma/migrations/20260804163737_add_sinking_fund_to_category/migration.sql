-- AlterTable
ALTER TABLE "SinkingFund" ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "SinkingFund" ADD CONSTRAINT "SinkingFund_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
