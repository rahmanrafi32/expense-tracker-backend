import { Dayjs } from 'dayjs';
import { type RemainingDuration } from '../common/types/remaining-duration.type';

export function getRemainingDuration(
  from: Dayjs,
  to: Dayjs,
): RemainingDuration {
  if (!to.isAfter(from)) {
    return {
      exactMonths: 0,
      months: 0,
      days: 0,
    };
  }

  const exactMonths = to.diff(from, 'month', true);

  let months = Math.floor(exactMonths);
  let monthAnchor = from.add(months, 'month');

  if (monthAnchor.isAfter(to)) {
    months -= 1;
    monthAnchor = from.add(months, 'month');
  }

  const days = to.diff(monthAnchor, 'day');

  return {
    exactMonths,
    months,
    days,
  };
}
