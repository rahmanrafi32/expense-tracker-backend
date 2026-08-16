import { Module } from '@nestjs/common';

import { EmailNotificationModule } from '../email-notification/email-notification.module';
import { CronController } from './cron.controller';
import { CronGuard } from './cron.guard';
import { NotificationService } from '../notification/notification.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule, EmailNotificationModule],
  controllers: [CronController],
  providers: [CronGuard, NotificationService],
})
export class CronModule {}
