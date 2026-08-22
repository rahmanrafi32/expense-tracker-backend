-- CreateEnum
CREATE TYPE "ReserveAllocationType" AS ENUM ('EMERGENCY_REPAYMENT', 'SINKING_FUND', 'GOAL');

-- CreateTable
CREATE TABLE "AllocationBatch" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReserveAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "ReserveAllocationType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sinkingFundId" TEXT,
    "goalId" TEXT,
    "emergencyFundId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReserveAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationBatch_bookId_idx" ON "AllocationBatch"("bookId");

-- CreateIndex
CREATE INDEX "AllocationBatch_date_idx" ON "AllocationBatch"("date");

-- CreateIndex
CREATE INDEX "ReserveAllocation_batchId_idx" ON "ReserveAllocation"("batchId");

-- CreateIndex
CREATE INDEX "ReserveAllocation_sinkingFundId_idx" ON "ReserveAllocation"("sinkingFundId");

-- CreateIndex
CREATE INDEX "ReserveAllocation_goalId_idx" ON "ReserveAllocation"("goalId");

-- CreateIndex
CREATE INDEX "ReserveAllocation_emergencyFundId_idx" ON "ReserveAllocation"("emergencyFundId");

-- AddForeignKey
ALTER TABLE "AllocationBatch" ADD CONSTRAINT "AllocationBatch_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveAllocation" ADD CONSTRAINT "ReserveAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AllocationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveAllocation" ADD CONSTRAINT "ReserveAllocation_sinkingFundId_fkey" FOREIGN KEY ("sinkingFundId") REFERENCES "SinkingFund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveAllocation" ADD CONSTRAINT "ReserveAllocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveAllocation" ADD CONSTRAINT "ReserveAllocation_emergencyFundId_fkey" FOREIGN KEY ("emergencyFundId") REFERENCES "EmergencyFund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
