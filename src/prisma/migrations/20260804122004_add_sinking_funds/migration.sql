-- CreateTable
CREATE TABLE "SinkingFund" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "savedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'piggy-bank',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SinkingFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SinkingFundDeposit" (
    "id" TEXT NOT NULL,
    "sinkingFundId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SinkingFundDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SinkingFund_bookId_idx" ON "SinkingFund"("bookId");

-- CreateIndex
CREATE INDEX "SinkingFundDeposit_sinkingFundId_idx" ON "SinkingFundDeposit"("sinkingFundId");

-- AddForeignKey
ALTER TABLE "SinkingFund" ADD CONSTRAINT "SinkingFund_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SinkingFundDeposit" ADD CONSTRAINT "SinkingFundDeposit_sinkingFundId_fkey" FOREIGN KEY ("sinkingFundId") REFERENCES "SinkingFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
