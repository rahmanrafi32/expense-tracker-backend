-- A linked sinking fund belongs to its recurring expense.
ALTER TABLE "SinkingFund"
DROP CONSTRAINT "SinkingFund_recurringExpenseId_fkey";

ALTER TABLE "SinkingFund"
ADD CONSTRAINT "SinkingFund_recurringExpenseId_fkey"
FOREIGN KEY ("recurringExpenseId") REFERENCES "ReccuringExpenses"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
