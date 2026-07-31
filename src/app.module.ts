import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { BookModule } from './book/book.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { RecurringExpenseModule } from './recurring-expense/recurring-expense.module';
import { GoalsModule } from './goals/goals.module';
import { EmergencyFundsModule } from './emergency-funds/emergency-funds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UserModule,
    AuthModule,
    BookModule,
    TransactionModule,
    CategoryModule,
    PaymentMethodModule,
    RecurringExpenseModule,
    GoalsModule,
    EmergencyFundsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
