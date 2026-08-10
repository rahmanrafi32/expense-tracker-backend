import { type ExpenseFrequency } from '@prisma/client';

export const EXPENSE_FREQUENCY_MONTHS: Readonly<
  Record<ExpenseFrequency, number>
> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};
