-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('LENT', 'BORROWED');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "loanId" TEXT;

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "personName" VARCHAR(200) NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "expectedPayoffDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationConsumption" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "AllocationConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_bookId_expectedPayoffDate_idx" ON "Loan"("bookId", "expectedPayoffDate");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRepayment_transactionId_key" ON "LoanRepayment"("transactionId");

-- CreateIndex
CREATE INDEX "LoanRepayment_loanId_date_idx" ON "LoanRepayment"("loanId", "date");

-- CreateIndex
CREATE INDEX "AllocationConsumption_transactionId_idx" ON "AllocationConsumption"("transactionId");

-- CreateIndex
CREATE INDEX "AllocationConsumption_batchId_idx" ON "AllocationConsumption"("batchId");

-- CreateIndex
CREATE INDEX "Transaction_loanId_idx" ON "Transaction"("loanId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationConsumption" ADD CONSTRAINT "AllocationConsumption_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationConsumption" ADD CONSTRAINT "AllocationConsumption_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AllocationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
