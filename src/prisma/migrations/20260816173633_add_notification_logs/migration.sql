-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RECURRING_PAYMENT_7_DAY', 'RECURRING_PAYMENT_1_DAY', 'RECURRING_PAYMENT_DUE');

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "occurrenceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_type_referenceId_occurrenceDate_key" ON "NotificationLog"("userId", "type", "referenceId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
