/*
  Warnings:

  - You are about to alter the column `targetAmount` on the `SinkingFund` table. The data in the column could be lost. The data in the column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `savedAmount` on the `SinkingFund` table. The data in the column could be lost. The data in the column will be cast from `DoublePrecision` to `Decimal(14,2)`.
  - You are about to alter the column `amount` on the `SinkingFundDeposit` table. The data in the column could be lost. The data in the column will be cast from `DoublePrecision` to `Decimal(14,2)`.
*/

ALTER TABLE "SinkingFund"
  ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(14,2),
  ALTER COLUMN "savedAmount" SET DATA TYPE DECIMAL(14,2);

ALTER TABLE "SinkingFundDeposit"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);
