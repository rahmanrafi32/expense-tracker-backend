BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Link an existing exact matching standalone fund only when the match is unique.
WITH matching_funds AS (
  SELECT
    re.id AS recurring_expense_id,
    sf.id AS sinking_fund_id,
    COUNT(*) OVER (PARTITION BY re.id) AS match_count
  FROM "ReccuringExpenses" re
  JOIN "SinkingFund" sf
    ON sf."bookId" = re."bookId"
   AND LOWER(sf.name) = LOWER(re.name)
   AND sf."recurringExpenseId" IS NULL
   AND sf."targetAmount" = re.amount
   AND sf.deadline = re."nextDueDate"
  WHERE re.frequency <> 'MONTHLY'
    AND NOT EXISTS (
      SELECT 1
      FROM "SinkingFund" linked
      WHERE linked."recurringExpenseId" = re.id
    )
)
UPDATE "SinkingFund" sf
SET "recurringExpenseId" = mf.recurring_expense_id,
    "updatedAt" = CURRENT_TIMESTAMP
FROM matching_funds mf
WHERE mf.sinking_fund_id = sf.id
  AND mf.match_count = 1;

-- Create a fund for every remaining non-monthly recurring expense.
INSERT INTO "SinkingFund" (
  id,
  "bookId",
  name,
  "targetAmount",
  "savedAmount",
  deadline,
  "categoryId",
  "recurringExpenseId",
  "cycleStartedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  re."bookId",
  re.name,
  re.amount,
  0,
  re."nextDueDate",
  re."categoryId",
  re.id,
  re."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ReccuringExpenses" re
WHERE re.frequency <> 'MONTHLY'
  AND NOT EXISTS (
    SELECT 1
    FROM "SinkingFund" sf
    WHERE sf."recurringExpenseId" = re.id
  );

COMMIT;
