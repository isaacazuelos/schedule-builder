/** Returns YYYY-MM-DD string for a Date object (local time). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a YYYY-MM-DD string to a Date at local midnight. */
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Returns all calendar days (YYYY-MM-DD) in a YYYY-MM month. */
export function getDaysInMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const days: string[] = [];
  const date = new Date(y!, m! - 1, 1);
  while (date.getMonth() === m! - 1) {
    days.push(toDateString(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/** Returns Mon–Fri workdays in a month, excluding holidays. */
export function getWorkdays(yearMonth: string, holidays: string[]): string[] {
  const holidaySet = new Set(holidays);
  return getDaysInMonth(yearMonth).filter(d => {
    const dow = fromDateString(d).getDay(); // 0=Sun, 6=Sat
    return dow >= 1 && dow <= 5 && !holidaySet.has(d);
  });
}

/**
 * Groups an array of date strings into weeks (Mon–Sun buckets).
 * Returns an array of week arrays.
 */
export function groupByWeek(dates: string[]): string[][] {
  if (dates.length === 0) return [];
  const weeks: string[][] = [];
  let current: string[] = [];
  let prevWeekKey = '';

  for (const d of dates) {
    const weekKey = getISOWeekKey(fromDateString(d));
    if (weekKey !== prevWeekKey) {
      if (current.length > 0) weeks.push(current);
      current = [];
      prevWeekKey = weekKey;
    }
    current.push(d);
  }
  if (current.length > 0) weeks.push(current);
  return weeks;
}

/** Returns a string key for the ISO week containing date d (YYYY-Www). */
function getISOWeekKey(d: Date): string {
  // ISO week: week containing the Thursday of that week, year of that Thursday.
  const tmp = new Date(d.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Thursday in the same week
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const year = tmp.getFullYear();
  const weekNo = Math.ceil(((tmp.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

/** Returns the short day-of-week label for a YYYY-MM-DD date. */
export function dowLabel(date: string): string {
  return fromDateString(date).toLocaleDateString('en-CA', { weekday: 'short' });
}

/** Formats a YYYY-MM month string to a human-readable label like "March 2026". */
export function formatMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

/** Returns the YYYY-MM for the next month. */
export function nextMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y!, m!, 1); // first day of next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Returns the YYYY-MM for the previous month. */
export function prevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y!, m! - 2, 1); // first day of previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
