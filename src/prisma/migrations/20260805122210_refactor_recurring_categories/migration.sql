/*
  Warnings:

  - You are about to drop the column `category` on the `ReccuringExpenses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ReccuringExpenses" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- DropEnum
DROP TYPE "ExpenseCategory";

-- AddForeignKey
ALTER TABLE "ReccuringExpenses" ADD CONSTRAINT "ReccuringExpenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
