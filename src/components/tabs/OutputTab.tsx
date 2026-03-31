import { useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { getDaysInMonth, fromDateString, formatMonth } from '../../utils/dateUtils';
import { exportScheduleHtml } from '../../utils/exportImport';
import { SHIFT_LABELS } from '../../types';
import type { ShiftType } from '../../types';

const DOW_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function OutputTab() {
  const { state } = useApp();
  const previewRef = useRef<HTMLDivElement>(null);
  const { schedule, staff, holidays, targetMonth } = state;

  if (!schedule || schedule.status !== 'optimal') {
    return (
      <div className="empty-state">
        Generate a schedule first (Generate tab).
        {schedule?.status === 'infeasible' && (
          <p className="muted mt-8" style={{ fontSize: 13 }}>
            The last solve attempt was infeasible. Adjust constraints or availability and try again.
          </p>
        )}
      </div>
    );
  }

  const outputHtml = buildOutputHtml(schedule.month, schedule.assignments, staff, holidays);

  function handleCopy() {
    if (previewRef.current) {
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
  }

  function handleDownload() {
    exportScheduleHtml(outputHtml, schedule!.month);
  }

  // ── Calendar grid data ──────────────────────────────────────────────────────
  const allDays = getDaysInMonth(targetMonth);
  const weeks = buildWeekRows(allDays);

  const dayAssignments = new Map<string, { name: string; shift: ShiftType }[]>();
  for (const [staffId, dateMap] of Object.entries(schedule.assignments)) {
    const member = staff.find(s => s.id === staffId);
    if (!member) continue;
    for (const [date, shift] of Object.entries(dateMap)) {
      if (!dayAssignments.has(date)) dayAssignments.set(date, []);
      dayAssignments.get(date)!.push({ name: member.name, shift: shift as ShiftType });
    }
  }

  return (
    <div>
      {/* ── Calendar grid ── */}
      <div className="section">
        <div className="section-title">{formatMonth(targetMonth)}</div>
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
                const assignments = dayAssignments.get(day) ?? [];

                return (
                  <div key={day} className={`cal-day${isHoliday ? ' cal-day--holiday' : ''}`}>
                    <div className="cal-day-date">
                      {day.slice(8)}
                      {isHoliday && <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>Holiday</span>}
                    </div>
                    {!isHoliday && assignments.length === 0 && (
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

      {/* ── Export actions ── */}
      <div className="section">
        <div className="section-title">Export for SharePoint</div>
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={handleCopy}>
              Copy HTML (for SharePoint paste)
            </button>
            <button className="btn btn-secondary" onClick={handleDownload}>
              Download as HTML file
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Use "Copy HTML" then paste directly into a SharePoint page. Or download the file and upload.
          </p>
          <div
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: outputHtml }}
            style={{ marginTop: 16, overflowX: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── HTML generation ─────────────────────────────────────────────────────────

// UCalgary brand palette: phones → gold family, in-person → red family
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
  for (const dow of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    table += `<th style="${headerCellStyle}">${dow}</th>`;
  }
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
      table += `<td style="${cellStyle}">`;
      table += `<div style="font-weight:bold;margin-bottom:4px;">${day.slice(8)} <span style="font-weight:normal;color:#666;font-size:11px;">${dowAbbr}</span></div>`;
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
