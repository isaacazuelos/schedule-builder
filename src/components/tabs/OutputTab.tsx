import { useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { getDaysInMonth, getWorkdays, fromDateString, formatMonth } from '../../utils/dateUtils';
import { exportScheduleHtml } from '../../utils/exportImport';
import { solveSchedule } from '../../utils/ilpSolver';
import { ALL_SHIFTS, SHIFT_LABELS } from '../../types';
import type { ShiftType } from '../../types';

const DOW_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function OutputTab() {
  const { state, setTargetMonth, setSolveStatus, setSchedule } = useApp();
  const previewRef = useRef<HTMLDivElement>(null);
  const { schedule, staff, holidays, targetMonth } = state;

  const workdays = getWorkdays(targetMonth, holidays);
  const hasSchedule = schedule?.status === 'optimal';

  // ── Solve ───────────────────────────────────────────────────────────────────
  function handleGenerate() {
    if (staff.length === 0) { alert('Add staff members first.'); return; }
    if (workdays.length === 0) { alert('No workdays in the selected month.'); return; }

    setSolveStatus('solving');
    setTimeout(() => {
      try {
        const unavailMap = new Map<string, Set<string>>();
        for (const s of staff) {
          const unavail = new Set(state.csvUnavailability[s.id] ?? []);
          for (const o of state.overrides) {
            if (o.staffId !== s.id) continue;
            if (o.available) unavail.delete(o.date);
            else unavail.add(o.date);
          }
          unavailMap.set(s.id, unavail);
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

  function handleCopy() {
    if (!previewRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(previewRef.current);
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();
    alert('Schedule HTML copied to clipboard. Paste into SharePoint.');
  }

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
                if (!day) return <div key={`${wi}-${di}`} style={{ background: '#f8f9fa', borderRadius: 4 }} />;
                const isHoliday = holidays.includes(day);
                const assignments = dayAssignments.get(day) ?? [];
                return (
                  <div key={day} className={`cal-day${isHoliday ? ' cal-day--holiday' : ''}`}>
                    <div className="cal-day-date">
                      {day.slice(8)}
                      {isHoliday && <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>Holiday</span>}
                    </div>
                    {!isHoliday && hasSchedule && assignments.length === 0 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>No assignments</div>
                    )}
                    {assignments.sort((a, b) => a.shift.localeCompare(b.shift)).map((a, i) => (
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
                  <td><span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span> slots/day</td>
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
      {hasSchedule && (
        <div className="section">
          <div className="section-title">Export for SharePoint</div>
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={handleCopy}>
                Copy HTML (for SharePoint paste)
              </button>
              <button className="btn btn-secondary" onClick={() => exportScheduleHtml(outputHtml!, schedule!.month)}>
                Download as HTML file
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Use "Copy HTML" then paste directly into a SharePoint page. Or download the file and upload.
            </p>
            <div
              ref={previewRef}
              dangerouslySetInnerHTML={{ __html: outputHtml! }}
              style={{ marginTop: 16, overflowX: 'auto' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HTML generation ─────────────────────────────────────────────────────────

const SHIFT_COLORS: Record<ShiftType, string> = {
  'phones-am': '#fff3b0',
  'phones-pm': '#ffe066',
  'inperson-am': '#ffd0d5',
  'inperson-pm': '#ffaab3',
};

function buildOutputHtml(
  month: string,
  assignments: Record<string, Record<string, string>>,
  staff: { id: string; name: string }[],
  holidays: string[]
): string {
  const allDays = getDaysInMonth(month);
  const holidaySet = new Set(holidays);

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
  const cellStyle = 'border:1px solid #ccc;padding:8px;vertical-align:top;min-width:120px;';
  const headerCellStyle = `${cellStyle}background:#f0f0f0;font-weight:bold;text-align:center;`;
  const holidayCellStyle = `${cellStyle}background:#e9ecef;color:#888;`;
  const emptyCellStyle = `${cellStyle}background:#fafafa;`;

  let table = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%;">`;
  table += `<caption style="font-size:16px;font-weight:bold;padding:8px 0;text-align:left;">${formatMonth(month)}</caption>`;
  table += '<thead><tr>';
  for (const dow of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    table += `<th style="${headerCellStyle}">${dow}</th>`;
  table += '</tr></thead><tbody>';

  for (const week of weeks) {
    table += '<tr>';
    for (const day of week) {
      if (!day) { table += `<td style="${emptyCellStyle}"></td>`; continue; }
      if (holidaySet.has(day)) {
        table += `<td style="${holidayCellStyle}"><strong>${day.slice(8)}</strong><br/><em>Holiday</em></td>`;
        continue;
      }
      const sorted = [...(dayMap.get(day) ?? [])].sort((a, b) => a.shift.localeCompare(b.shift));
      const dowAbbr = fromDateString(day).toLocaleDateString('en-CA', { weekday: 'short' });
      table += `<td style="${cellStyle}"><div style="font-weight:bold;margin-bottom:4px;">${day.slice(8)} <span style="font-weight:normal;color:#666;font-size:11px;">${dowAbbr}</span></div>`;
      if (sorted.length === 0) {
        table += `<span style="color:#aaa;font-size:11px;">—</span>`;
      } else {
        for (const a of sorted) {
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

function buildWeekRows(allDays: string[]): (string | null)[][] {
  if (allDays.length === 0) return [];
  const daySet = new Set(allDays);
  const cursor = new Date(fromDateString(allDays[0]!));
  const firstDow = cursor.getDay();
  cursor.setDate(cursor.getDate() - (firstDow === 0 ? 6 : firstDow - 1));
  const lastDay = fromDateString(allDays[allDays.length - 1]!);
  const weeks: (string | null)[][] = [];
  while (cursor <= lastDay) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 5; d++) {
      const s = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      week.push(daySet.has(s) ? s : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    cursor.setDate(cursor.getDate() + 2);
    weeks.push(week);
  }
  return weeks;
}
