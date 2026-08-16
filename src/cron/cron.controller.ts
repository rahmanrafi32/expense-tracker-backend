import { Controller, Get, UseGuards } from '@nestjs/common';
import { CronGuard } from './cron.guard';
import { NotificationService } from '../notification/notification.service';

@Controller('cron')
@UseGuards(CronGuard)
export class CronController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('daily')
  daily() {
    return this.notificationService.processDailyNotifications();
  }
}
