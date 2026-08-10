/*
  Warnings:

  - You are about to alter the column `targetAmount` on the `Goal` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `savedAmount` on the `Goal` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `GoalDeposit` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(14,2)`.

*/
-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(14,2),
ALTER COLUMN "savedAmount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "GoalDeposit" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);
