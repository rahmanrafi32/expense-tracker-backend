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
}
