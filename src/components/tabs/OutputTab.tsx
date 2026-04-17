import { useApp } from '../../store/AppContext';
import { getDaysInMonth, getWorkdays, fromDateString, formatMonth, toDateString } from '../../utils/dateUtils';
import { exportScheduleHtml } from '../../utils/exportImport';
import { solveSchedule } from '../../utils/ilpSolver';
import { ALL_SHIFTS, DAILY_SHIFTS, WEEKLY_SHIFTS, SHIFT_LABELS } from '../../types';
import type { ShiftType } from '../../types';

const DOW_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OutputTab() {
  const { state, isAvailable, setTargetMonth, setSolveStatus, setSchedule } = useApp();
  const { schedule, staff, holidays, targetMonth } = state;

  const workdays = getWorkdays(targetMonth, holidays);
  const hasSchedule = schedule?.status === 'optimal';

  function handleGenerate() {
    if (staff.length === 0) { alert('Add staff members first.'); return; }
    if (workdays.length === 0) { alert('No workdays in the selected month.'); return; }

    setSolveStatus('solving');
    setTimeout(() => {
      try {
        const unavailMap = new Map<string, { am: Set<string>; pm: Set<string> }>();
        for (const s of staff) {
          const am = new Set<string>();
          const pm = new Set<string>();
          for (const d of workdays) {
            if (!isAvailable(s.id, d, 'am')) am.add(d);
            if (!isAvailable(s.id, d, 'pm')) pm.add(d);
          }
          unavailMap.set(s.id, { am, pm });
        }
        setSchedule(solveSchedule(staff, workdays, state.slotCounts, state.weeklyCaps, unavailMap));
      } catch (e) {
        setSchedule({
          month: targetMonth,
          assignments: {},
          status: 'error',
          message: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }, 50);
  }

  // ── Calendar grid data ──────────────────────────────────────────────────────
  const calMonth = hasSchedule ? schedule!.month : targetMonth;
  const allDays = getDaysInMonth(calMonth);
  const monthDaySet = new Set(allDays);
  const weeks = buildWeekRows(allDays);

  const dayAssignments = new Map<string, { name: string; shift: ShiftType }[]>();
  if (hasSchedule) {
    for (const [staffId, dateMap] of Object.entries(schedule!.assignments)) {
      const member = staff.find(s => s.id === staffId);
      if (!member) continue;
      for (const [date, shift] of Object.entries(dateMap)) {
        if (!dayAssignments.has(date)) dayAssignments.set(date, []);
        dayAssignments.get(date)!.push({ name: member.name, shift: shift as ShiftType });
      }
    }
  }

  // ── Per-person shift counts ─────────────────────────────────────────────────
  const personCounts = hasSchedule
    ? staff.map(s => {
        const dateMap = schedule!.assignments[s.id] ?? {};
        const byType: Partial<Record<ShiftType, number>> = {};
        let total = 0;
        for (const shift of Object.values(dateMap) as ShiftType[]) {
          byType[shift] = (byType[shift] ?? 0) + 1;
          total++;
        }
        return { name: s.name, total, byType };
      }).sort((a, b) => b.total - a.total)
    : [];

  // ── SharePoint HTML ─────────────────────────────────────────────────────────
  const outputHtml = hasSchedule
    ? buildOutputHtml(schedule!.month, schedule!.assignments, staff, holidays)
    : null;

  return (
    <div>
      {/* ── Calendar ── */}
      <div className="section">
        <div className="section-title">{formatMonth(calMonth)}</div>
        <div className="card" style={{ padding: 12 }}>
          <div className="cal-grid">
            {DOW_HEADERS.map(d => <div key={d} className="cal-header">{d}</div>)}
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                const inMonth = monthDaySet.has(day);
                const dow = fromDateString(day).getDay();
                const isSunday   = dow === 0;
                const isSaturday = dow === 6;
                const isHolidayDay = inMonth && holidays.includes(day);
                const isWorkday = inMonth && !isSunday && !isSaturday && !isHolidayDay;

                const qpList = dayAssignments.get(day)?.filter(a => WEEKLY_SHIFTS.includes(a.shift)) ?? [];
                const regularList = dayAssignments.get(day)?.filter(a => DAILY_SHIFTS.includes(a.shift)) ?? [];

                let bg = inMonth ? 'var(--color-surface)' : '#f0f0f0';
                if (isSunday)        bg = inMonth ? '#eef4ff' : '#f5f5ff';
                else if (isSaturday) bg = inMonth ? '#f8f9fa' : '#f0f0f0';
                else if (isHolidayDay) bg = '#efefef';

                return (
                  <div
                    key={`${wi}-${di}`}
                    className={`cal-day${isHolidayDay ? ' cal-day--holiday' : ''}`}
                    style={{ background: bg }}
                  >
                    <div
                      className="cal-day-date"
                      style={{ color: inMonth ? undefined : 'var(--color-text-muted)' }}
                    >
                      {day.slice(8)}
                      {isHolidayDay && <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>Holiday</span>}
                    </div>

                    {/* QP assignments shown only in Sunday cell */}
                    {isSunday && qpList.sort((a, b) => a.shift.localeCompare(b.shift)).map((a, i) => (
                      <div key={i} className="cal-assignment">
                        <span className={`shift-chip shift-${a.shift}`} style={{ fontSize: 10 }}>
                          {SHIFT_LABELS[a.shift]}
                        </span>
                        <span style={{ fontSize: 11 }}>{a.name}</span>
                      </div>
                    ))}

                    {/* Regular daily assignments on workdays */}
                    {isWorkday && hasSchedule && regularList.length === 0 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>No assignments</div>
                    )}
                    {isWorkday && regularList.sort((a, b) => a.shift.localeCompare(b.shift)).map((a, i) => (
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

      {/* ── Generate controls ── */}
      <div className="section">
        <div className="section-title">Generate</div>
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <label>
              Month:
              <input
                type="month"
                value={targetMonth}
                onChange={e => setTargetMonth(e.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={state.solveStatus === 'solving' || staff.length === 0}
            >
              {state.solveStatus === 'solving' ? 'Solving…' : 'Generate Schedule'}
            </button>
          </div>

          {state.solveStatus === 'solving' && (
            <div className="status-banner status-banner--info" style={{ marginBottom: 0 }}>
              Solving…
            </div>
          )}
          {schedule?.status === 'infeasible' && (
            <div className="status-banner status-banner--error" style={{ marginBottom: 0 }}>
              <strong>Infeasible:</strong> {schedule.message}
            </div>
          )}
          {schedule?.status === 'error' && (
            <div className="status-banner status-banner--error" style={{ marginBottom: 0 }}>
              <strong>Error:</strong> {schedule.message}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="section">
        <div className="section-title">Summary</div>
        <div className="card">
          <table className="data-table" style={{ width: 'auto', marginBottom: 16 }}>
            <tbody>
              <tr><td>Staff members</td><td><strong>{staff.length}</strong></td></tr>
              <tr><td>Workdays</td><td><strong>{workdays.length}</strong>
                {holidays.length > 0 && <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>({holidays.length} holiday(s) excluded)</span>}
              </td></tr>
              {ALL_SHIFTS.map(s => (
                <tr key={s}>
                  <td>
                    <span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span>
                    {' '}shifts/{WEEKLY_SHIFTS.includes(s) ? 'week' : 'day'}
                  </td>
                  <td><strong>{state.slotCounts[s]}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasSchedule && personCounts.length > 0 && (
            <>
              <div className="section-title" style={{ marginBottom: 8 }}>Shifts per person</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total</th>
                    {ALL_SHIFTS.map(s => <th key={s}><span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {personCounts.map(p => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td><strong>{p.total}</strong></td>
                      {ALL_SHIFTS.map(s => (
                        <td key={s} style={{ textAlign: 'center' }}>{p.byType[s] ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* ── Export ── */}
      <div className="section">
        <div className="section-title">Export for SharePoint</div>
        <div className="card">
          <button
            className="btn btn-secondary"
            disabled={!hasSchedule}
            onClick={() => exportScheduleHtml(outputHtml!, schedule!.month)}
          >
            Download as HTML file
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HTML generation ─────────────────────────────────────────────────────────

const SHIFT_COLORS: Record<ShiftType, string> = {
  'phones-am':   '#fff3b0',
  'phones-pm':   '#ffe066',
  'inperson-am': '#ffd0d5',
  'inperson-pm': '#ffaab3',
  'qp-am':       '#c8ead8',
  'qp-pm':       '#8ecfb0',
};

function buildOutputHtml(
  month: string,
  assignments: Record<string, Record<string, string>>,
  staff: { id: string; name: string }[],
  holidays: string[]
): string {
  const allDays = getDaysInMonth(month);
  const holidaySet = new Set(holidays);
  const monthDaySet = new Set(allDays);

  const dayMap = new Map<string, { name: string; shift: ShiftType }[]>();
  for (const [staffId, dateMap] of Object.entries(assignments)) {
    const member = staff.find(s => s.id === staffId);
    if (!member) continue;
    for (const [date, shift] of Object.entries(dateMap)) {
      if (!dayMap.has(date)) dayMap.set(date, []);
      dayMap.get(date)!.push({ name: member.name, shift: shift as ShiftType });
    }
  }

  const weeks = buildWeekRows(allDays);
  const cellStyle    = 'border:1px solid #ccc;padding:6px;vertical-align:top;min-width:90px;';
  const headerStyle  = `${cellStyle}background:#f0f0f0;font-weight:bold;text-align:center;`;
  const holidayStyle = `${cellStyle}background:#e9ecef;color:#888;`;
  const weekendStyle = `${cellStyle}background:#f8f9fa;`;
  const outsideStyle = `${cellStyle}background:#f0f0f0;color:#bbb;`;
  const sundayStyle  = `${cellStyle}background:#eef4ff;`;

  let table = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%;">`;
  table += `<caption style="font-size:16px;font-weight:bold;padding:8px 0;text-align:left;">${formatMonth(month)}</caption>`;
  table += '<thead><tr>';
  for (const dow of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    table += `<th style="${headerStyle}">${dow}</th>`;
  table += '</tr></thead><tbody>';

  for (const week of weeks) {
    table += '<tr>';
    for (const day of week) {
      const inMonth = monthDaySet.has(day);
      const dow = fromDateString(day).getDay();
      const isSunday = dow === 0;
      const isSat = dow === 6;
      const isHoliday = inMonth && holidaySet.has(day);
      const isWorkday = inMonth && !isSunday && !isSat && !isHoliday;

      const qpList = dayMap.get(day)?.filter(a => WEEKLY_SHIFTS.includes(a.shift)) ?? [];
      const regularList = dayMap.get(day)?.filter(a => DAILY_SHIFTS.includes(a.shift)) ?? [];

      if (!inMonth) {
        table += `<td style="${outsideStyle}"><div style="font-weight:bold;">${day.slice(8)}</div></td>`;
        continue;
      }
      if (isHoliday) {
        table += `<td style="${holidayStyle}"><strong>${day.slice(8)}</strong><br/><em>Holiday</em></td>`;
        continue;
      }
      if (isSat) {
        table += `<td style="${weekendStyle}"><div style="font-weight:bold;">${day.slice(8)}</div></td>`;
        continue;
      }

      const style = isSunday ? sundayStyle : cellStyle;
      table += `<td style="${style}"><div style="font-weight:bold;margin-bottom:4px;">${day.slice(8)}</div>`;

      const items = isSunday ? qpList : (isWorkday ? regularList.sort((a, b) => a.shift.localeCompare(b.shift)) : []);
      if (items.length === 0 && (isSunday || isWorkday)) {
        table += `<span style="color:#aaa;font-size:11px;">—</span>`;
      } else {
        for (const a of items) {
          const bg = SHIFT_COLORS[a.shift] ?? '#eee';
          table += `<div style="margin-bottom:3px;"><span style="background:${bg};padding:1px 5px;border-radius:3px;font-size:11px;display:inline-block;">${SHIFT_LABELS[a.shift]}</span> ${escapeHtml(a.name)}</div>`;
        }
      }
      table += '</td>';
    }
    table += '</tr>';
  }
  table += '</tbody></table>';
  return table;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Builds 7-column (Sun–Sat) week rows for a month.
 * Every cell is a YYYY-MM-DD string (may be outside the month).
 */
function buildWeekRows(allDays: string[]): string[][] {
  if (allDays.length === 0) return [];
  const cursor = fromDateString(allDays[0]!);
  cursor.setDate(cursor.getDate() - cursor.getDay()); // back to Sunday
  const lastDay = fromDateString(allDays[allDays.length - 1]!);
  const weeks: string[][] = [];
  while (cursor <= lastDay) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(toDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
