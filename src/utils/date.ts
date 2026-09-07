import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Dhaka';

export const localCalendarDay = (value: Date | string) =>
  dayjs(value).tz(APP_TIMEZONE).startOf('day');

export const daysUntilLocalCalendarDay = (value: Date | string) =>
  localCalendarDay(value).diff(dayjs().tz(APP_TIMEZONE).startOf('day'), 'day');

export const formatLocalDate = (
  value: Date | string,
  month: 'short' | 'long' = 'short',
) =>
  new Intl.DateTimeFormat('en-BD', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month,
    day: 'numeric',
  }).format(new Date(value));
