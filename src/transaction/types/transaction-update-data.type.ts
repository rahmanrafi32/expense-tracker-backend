import { type Prisma } from '@prisma/client';
import { type TransactionType } from '../enums/transaction-type.enum';

export interface TransactionUpdateData {
  type?: TransactionType;
  remark?: string;
  date?: Date;
  amount?: string | Prisma.Decimal;
  categoryId?: string;
  paymentMethodId?: string;
}
