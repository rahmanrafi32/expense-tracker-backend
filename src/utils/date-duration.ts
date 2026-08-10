import { Dayjs } from 'dayjs';

export interface RemainingDuration {
  exactMonths: number;
  months: number;
  days: number;
}

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

  let months = to.diff(from, 'month');
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
