import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import dayjs, { Dayjs } from 'dayjs';

import { PrismaService } from '../database/prisma.service';
import { EmailNotificationService } from '../email-notification/email-notification.service';

interface ReminderExpense {
  id: string;
  name: string;
  amount: Prisma.Decimal;
  nextDueDate: Date;
  userId: string;
  email: string;
  firstName: string;
  notificationType: NotificationType;
  occurrenceDate: Date;
  daysUntilDue: number;
}

interface UserReminderGroup {
  userId: string;
  email: string;
  firstName: string;
  reminders: ReminderExpense[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  async processDailyNotifications() {
    const now = dayjs().startOf('day');

    this.logger.log(
      `Starting daily notification processing for ${now.format('YYYY-MM-DD')}`,
    );

    try {
      const paymentReminders = await this.processRecurringPaymentReminders(now);

      this.logger.log(
        `Daily notification processing completed successfully. ` +
          `Processed: ${paymentReminders.processed}, ` +
          `Emails sent: ${paymentReminders.sent}, ` +
          `Skipped: ${paymentReminders.skipped}, ` +
          `Failed: ${paymentReminders.failed}`,
      );

      return {
        success: true,
        processedAt: now.toISOString(),
        paymentReminders,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Daily notification processing failed',
        error instanceof Error ? error.stack : JSON.stringify(error),
      );

      throw error;
    }
  }

  private async processRecurringPaymentReminders(now: Dayjs) {
    const endDate = now.add(7, 'day').endOf('day');

    this.logger.log(
      `Checking recurring payments due between ` +
        `${now.format('YYYY-MM-DD')} and ` +
        `${endDate.format('YYYY-MM-DD')}`,
    );

    const expenses = await this.prisma.reccuringExpenses.findMany({
      where: {
        nextDueDate: {
          gte: now.toDate(),
          lte: endDate.toDate(),
        },
      },
      select: {
        id: true,
        name: true,
        amount: true,
        nextDueDate: true,
        book: {
          select: {
            userId: true,
            user: {
              select: {
                email: true,
                firstName: true,
              },
            },
          },
        },
      },
      orderBy: {
        nextDueDate: 'asc',
      },
    });

    this.logger.log(
      `Found ${expenses.length} recurring payment(s) within the ` +
        `7-day notification window`,
    );

    const reminders: ReminderExpense[] = [];

    let processed = 0;
    let skipped = 0;

    for (const expense of expenses) {
      processed++;

      const daysUntilDue = dayjs(expense.nextDueDate)
        .startOf('day')
        .diff(now, 'day');

      const notificationType = this.getNotificationType(daysUntilDue);

      this.logger.debug(
        `Evaluating recurring payment "${expense.name}" ` +
          `(${expense.id}) — due ${dayjs(expense.nextDueDate).format(
            'YYYY-MM-DD',
          )}, ${daysUntilDue} day(s) remaining`,
      );

      if (!notificationType) {
        this.logger.debug(
          `No notification required for "${expense.name}" (${expense.id})`,
        );

        continue;
      }

      const occurrenceDate = dayjs(expense.nextDueDate).startOf('day').toDate();

      const alreadySent = await this.prisma.notificationLog.findUnique({
        where: {
          userId_type_referenceId_occurrenceDate: {
            userId: expense.book.userId,
            type: notificationType,
            referenceId: expense.id,
            occurrenceDate,
          },
        },
      });

      if (alreadySent) {
        skipped++;

        this.logger.log(
          `Skipping notification for "${expense.name}" (${expense.id}) — ` +
            `${notificationType} already sent for ` +
            `${dayjs(occurrenceDate).format('YYYY-MM-DD')}`,
        );

        continue;
      }

      reminders.push({
        id: expense.id,
        name: expense.name,
        amount: expense.amount,
        nextDueDate: expense.nextDueDate,
        userId: expense.book.userId,
        email: expense.book.user.email,
        firstName: expense.book.user.firstName,
        notificationType,
        occurrenceDate,
        daysUntilDue,
      });

      this.logger.debug(
        `Added "${expense.name}" (${expense.id}) to the pending ` +
          `notification group for user ${expense.book.userId}`,
      );
    }

    if (reminders.length === 0) {
      this.logger.log(
        `No new payment reminders need to be sent today. ` +
          `Processed: ${processed}, Skipped: ${skipped}`,
      );

      return {
        processed,
        sent: 0,
        skipped,
        failed: 0,
      };
    }

    const groups = this.groupRemindersByUser(reminders);

    this.logger.log(
      `Grouped ${reminders.length} pending payment reminder(s) into ` +
        `${groups.length} user email group(s)`,
    );

    let sent = 0;
    let failed = 0;

    for (const group of groups) {
      const paymentCount = group.reminders.length;

      this.logger.log(
        `Preparing payment summary for ${group.email} ` +
          `(${group.userId}) — ${paymentCount} payment(s)`,
      );

      group.reminders.forEach((reminder) => {
        this.logger.debug(
          `  • ${reminder.name} — ` +
            `${reminder.amount.toFixed(2)} — ` +
            `${this.getDueDescription(reminder.daysUntilDue)} — ` +
            `${reminder.notificationType}`,
        );
      });

      try {
        await this.emailNotificationService.sendRecurringPaymentReminder({
          to: group.email,
          firstName: group.firstName,
          payments: group.reminders.map((reminder) => ({
            name: reminder.name,
            amount: reminder.amount,
            dueDate: reminder.nextDueDate,
            daysUntilDue: reminder.daysUntilDue,
          })),
        });

        this.logger.log(
          `Payment summary email sent successfully to ${group.email}`,
        );

        await this.prisma.notificationLog.createMany({
          data: group.reminders.map((reminder) => ({
            userId: reminder.userId,
            type: reminder.notificationType,
            referenceId: reminder.id,
            occurrenceDate: reminder.occurrenceDate,
          })),
          skipDuplicates: true,
        });

        sent++;

        this.logger.log(
          `Notification log created for ${paymentCount} payment(s) ` +
            `belonging to ${group.email}`,
        );
      } catch (error: unknown) {
        failed++;

        this.logger.error(
          `Failed to process payment summary for ${group.email} ` +
            `(${group.userId})`,
          error instanceof Error ? error.stack : JSON.stringify(error),
        );
      }
    }

    this.logger.log(
      `Recurring payment notification processing finished. ` +
        `Processed: ${processed}, ` +
        `Emails sent: ${sent}, ` +
        `Skipped: ${skipped}, ` +
        `Failed: ${failed}`,
    );

    return {
      processed,
      sent,
      skipped,
      failed,
    };
  }

  private groupRemindersByUser(
    reminders: ReminderExpense[],
  ): UserReminderGroup[] {
    const groups = new Map<string, UserReminderGroup>();

    for (const reminder of reminders) {
      const existingGroup = groups.get(reminder.userId);

      if (existingGroup) {
        existingGroup.reminders.push(reminder);
        continue;
      }

      groups.set(reminder.userId, {
        userId: reminder.userId,
        email: reminder.email,
        firstName: reminder.firstName,
        reminders: [reminder],
      });
    }

    return Array.from(groups.values());
  }

  private getNotificationType(daysUntilDue: number): NotificationType | null {
    switch (daysUntilDue) {
      case 7:
        return NotificationType.RECURRING_PAYMENT_7_DAY;

      case 1:
        return NotificationType.RECURRING_PAYMENT_1_DAY;

      case 0:
        return NotificationType.RECURRING_PAYMENT_DUE;

      default:
        return null;
    }
  }

  private getDueDescription(daysUntilDue: number): string {
    if (daysUntilDue < 0) {
      return `${Math.abs(daysUntilDue)} day(s) overdue`;
    }

    if (daysUntilDue === 0) {
      return 'due today';
    }

    if (daysUntilDue === 1) {
      return 'due tomorrow';
    }

    return `due in ${daysUntilDue} days`;
  }
}
