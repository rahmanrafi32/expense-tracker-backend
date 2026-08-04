-- CreateEnum
CREATE TYPE "CommitmentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('PAID', 'UNPAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "EmergencyFundType" AS ENUM ('WITHDRAWAL', 'REPAYMENT');

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "CommitmentFrequency" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'shield',
    "status" "CommitmentStatus" NOT NULL DEFAULT 'UNPAID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyFund" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "type" "EmergencyFundType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remark" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "savedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'target',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalDeposit" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commitment_bookId_idx" ON "Commitment"("bookId");

-- CreateIndex
CREATE INDEX "Commitment_nextDueDate_idx" ON "Commitment"("nextDueDate");

-- CreateIndex
CREATE INDEX "EmergencyFund_bookId_idx" ON "EmergencyFund"("bookId");

-- CreateIndex
CREATE INDEX "EmergencyFund_date_idx" ON "EmergencyFund"("date");

-- CreateIndex
CREATE INDEX "Goal_bookId_idx" ON "Goal"("bookId");

-- CreateIndex
CREATE INDEX "GoalDeposit_goalId_idx" ON "GoalDeposit"("goalId");

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyFund" ADD CONSTRAINT "EmergencyFund_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalDeposit" ADD CONSTRAINT "GoalDeposit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
