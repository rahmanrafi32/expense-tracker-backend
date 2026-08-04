/*
  Warnings:

  - You are about to drop the `Commitment` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('INSURANCE', 'PENSION', 'INSTALLMENT', 'UTILITY', 'INTERNET', 'RENT', 'SUBSCRIPTION', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PAID', 'UNPAID', 'OVERDUE');

-- DropForeignKey
ALTER TABLE "Commitment" DROP CONSTRAINT "Commitment_bookId_fkey";

-- DropTable
DROP TABLE "Commitment";

-- DropEnum
DROP TYPE "CommitmentFrequency";

-- DropEnum
DROP TYPE "CommitmentStatus";

-- CreateTable
CREATE TABLE "ReccuringExpenses" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "frequency" "ExpenseFrequency" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReccuringExpenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReccuringExpenses_bookId_idx" ON "ReccuringExpenses"("bookId");

-- CreateIndex
CREATE INDEX "ReccuringExpenses_nextDueDate_idx" ON "ReccuringExpenses"("nextDueDate");

-- AddForeignKey
ALTER TABLE "ReccuringExpenses" ADD CONSTRAINT "ReccuringExpenses_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
