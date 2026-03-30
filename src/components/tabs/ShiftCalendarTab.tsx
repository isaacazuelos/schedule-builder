import { useApp } from '../../store/AppContext';
import { getDaysInMonth, fromDateString, formatMonth } from '../../utils/dateUtils';
import { SHIFT_LABELS } from '../../types';
import type { ShiftType } from '../../types';

const DOW_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function ShiftCalendarTab() {
  const { state } = useApp();
  const { schedule, targetMonth, staff, holidays } = state;

  const allDays = getDaysInMonth(targetMonth);

  // Build rows: each week row has Mon-Fri slots (null for weekend/out-of-month)
  const weeks = buildWeekRows(allDays);

  // Reverse lookup: date -> list of (staff name, shift)
  const dayAssignments = new Map<string, { name: string; shift: ShiftType }[]>();
  if (schedule) {
    for (const [staffId, dateMap] of Object.entries(schedule.assignments)) {
      const member = staff.find(s => s.id === staffId);
      if (!member) continue;
      for (const [date, shift] of Object.entries(dateMap)) {
        if (!dayAssignments.has(date)) dayAssignments.set(date, []);
        dayAssignments.get(date)!.push({ name: member.name, shift: shift as ShiftType });
      }
    }
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">{formatMonth(targetMonth)}</div>
        {!schedule && (
          <div className="status-banner status-banner--info">
            No schedule generated yet. Go to the Generate tab to run the solver.
          </div>
        )}
        {schedule && schedule.status !== 'optimal' && (
          <div className="status-banner status-banner--error">
            {schedule.message ?? 'Schedule is not optimal.'}
          </div>
        )}
        <div className="card" style={{ padding: 12 }}>
          <div className="cal-grid">
            {DOW_HEADERS.map(d => (
              <div key={d} className="cal-header">{d}</div>
            ))}
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                if (!day) {
                  return <div key={`${wi}-${di}`} style={{ background: '#f8f9fa', borderRadius: 4 }} />;
                }
                const isHoliday = holidays.includes(day);
                const isWeekend = (() => { const d = fromDateString(day).getDay(); return d === 0 || d === 6; })();
                const assignments = dayAssignments.get(day) ?? [];
                const dateNum = day.slice(8);

                return (
                  <div
                    key={day}
                    className={`cal-day${isHoliday ? ' cal-day--holiday' : ''}`}
                  >
                    <div className="cal-day-date">
                      {dateNum}
                      {isHoliday && <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>Holiday</span>}
                    </div>
                    {!isHoliday && !isWeekend && assignments.length === 0 && schedule && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>No assignments</div>
                    )}
                    {assignments
                      .sort((a, b) => a.shift.localeCompare(b.shift))
                      .map((a, i) => (
                        <div key={i} className="cal-assignment">
                          <span className={`shift-chip shift-${a.shift}`} style={{ fontSize: 10 }}>
                            {SHIFT_LABELS[a.shift]}
                          </span>
                          <span style={{ fontSize: 11 }}>{a.name}</span>
                        </div>
                      ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Builds a 2D array of week rows, each containing Mon-Fri date strings (or null for padding).
 * Weeks that extend before/after the month are padded with null.
 */
function buildWeekRows(allDays: string[]): (string | null)[][] {
  if (allDays.length === 0) return [];

  const firstDay = fromDateString(allDays[0]!);
  const weeks: (string | null)[][] = [];

  // Find the Monday of the first week
  let cursor = new Date(firstDay);
  const firstDow = cursor.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  // Move back to Monday
  const daysBack = firstDow === 0 ? 6 : firstDow - 1;
  cursor.setDate(cursor.getDate() - daysBack);

  const daySet = new Set(allDays);
  const lastDay = fromDateString(allDays[allDays.length - 1]!);

  while (cursor <= lastDay) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 5; d++) { // Mon-Fri only
      const dateStr = toDateStr(cursor);
      week.push(daySet.has(dateStr) ? dateStr : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    // Skip Saturday and Sunday
    cursor.setDate(cursor.getDate() + 2);
    weeks.push(week);
  }

  return weeks;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
