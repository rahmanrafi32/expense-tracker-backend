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
import { SinkingFundsModule } from './sinking-funds/sinking-funds.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { InsightsModule } from './insights/insights.module';
import { SpendingTrendsModule } from './spending-trends/spending-trends.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
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
    SinkingFundsModule,
    CashFlowModule,
    InsightsModule,
    SpendingTrendsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
