import {
  type ExpenseFrequency,
  type ExpenseStatus,
  type Prisma,
} from '@prisma/client';

export interface RecurringExpenseDisplayInput {
  amount: Prisma.Decimal;
  frequency: ExpenseFrequency;
  nextDueDate: Date;
  status: ExpenseStatus;
  sinkingFund?: {
    targetAmount: Prisma.Decimal;
    savedAmount: Prisma.Decimal;
  } | null;
}
