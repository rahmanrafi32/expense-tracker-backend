/*
  Warnings:

  - You are about to alter the column `bookTotalAmount` on the `Book` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `monthlyIncome` on the `Book` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `expectedMonthlyExpenses` on the `Book` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `ReccuringExpenses` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `Transaction` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.

*/
-- AlterTable
ALTER TABLE "Book" ALTER COLUMN "bookTotalAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "monthlyIncome" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "expectedMonthlyExpenses" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ReccuringExpenses" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);
