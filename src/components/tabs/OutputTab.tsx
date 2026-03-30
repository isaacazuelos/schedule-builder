import { useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { getDaysInMonth, fromDateString, formatMonth } from '../../utils/dateUtils';
import { exportScheduleHtml } from '../../utils/exportImport';
import { SHIFT_LABELS } from '../../types';
import type { ShiftType } from '../../types';

export default function OutputTab() {
  const { state } = useApp();
  const previewRef = useRef<HTMLDivElement>(null);

  const { schedule, staff, holidays } = state;

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

  const html = buildOutputHtml(schedule.month, schedule.assignments, staff, holidays);

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
    exportScheduleHtml(html, schedule!.month);
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">
          Schedule Output — {formatMonth(schedule.month)}
        </div>
        <div className="row mt-8" style={{ marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={handleCopy}>
            Copy HTML (for SharePoint paste)
          </button>
          <button className="btn btn-secondary" onClick={handleDownload}>
            Download as HTML file
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
          Use "Copy HTML" then paste directly into a SharePoint page. Or download the file and upload.
        </p>
      </div>

      <div className="section">
        <div className="section-title">Preview</div>
        <div
          className="card"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          <div
            ref={previewRef}
            dangerouslySetInnerHTML={{ __html: html }}
            style={{ padding: 16, overflowX: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── HTML generation ─────────────────────────────────────────────────────────

const SHIFT_COLORS: Record<ShiftType, string> = {
  'phones-am': '#cfe2ff',
  'phones-pm': '#b6d4fe',
  'inperson-am': '#d1e7dd',
  'inperson-pm': '#a3cfbb',
};

function buildOutputHtml(
  month: string,
  assignments: Record<string, Record<string, string>>,
  staff: { id: string; name: string }[],
  holidays: string[]
): string {
  const allDays = getDaysInMonth(month);
  const holidaySet = new Set(holidays);

  // date -> list of {name, shift}
  const dayMap = new Map<string, { name: string; shift: ShiftType }[]>();
  for (const [staffId, dateMap] of Object.entries(assignments)) {
    const member = staff.find(s => s.id === staffId);
    if (!member) continue;
    for (const [date, shift] of Object.entries(dateMap)) {
      if (!dayMap.has(date)) dayMap.set(date, []);
      dayMap.get(date)!.push({ name: member.name, shift: shift as ShiftType });
    }
  }

  // Build week rows (Mon-Fri)
  const weeks = buildWeekRows(allDays);

  const cellStyle = 'border:1px solid #ccc;padding:8px;vertical-align:top;min-width:120px;';
  const headerCellStyle = `${cellStyle}background:#f0f0f0;font-weight:bold;text-align:center;`;
  const holidayCellStyle = `${cellStyle}background:#e9ecef;color:#888;`;
  const emptyCellStyle = `${cellStyle}background:#fafafa;`;

  let table = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%;">`;
  table += `<caption style="font-size:16px;font-weight:bold;padding:8px 0;text-align:left;">${formatMonth(month)}</caption>`;

  // Header row
  table += '<thead><tr>';
  for (const dow of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    table += `<th style="${headerCellStyle}">${dow}</th>`;
  }
  table += '</tr></thead><tbody>';

  for (const week of weeks) {
    table += '<tr>';
    for (const day of week) {
      if (!day) {
        table += `<td style="${emptyCellStyle}"></td>`;
        continue;
      }
      const isHoliday = holidaySet.has(day);
      const dateNum = day.slice(8);
      const dowAbbr = fromDateString(day).toLocaleDateString('en-CA', { weekday: 'short' });

      if (isHoliday) {
        table += `<td style="${holidayCellStyle}"><strong>${dateNum}</strong><br/><em>Holiday</em></td>`;
        continue;
      }

      const rows = dayMap.get(day) ?? [];
      const sorted = [...rows].sort((a, b) => a.shift.localeCompare(b.shift));

      table += `<td style="${cellStyle}">`;
      table += `<div style="font-weight:bold;margin-bottom:4px;">${dateNum} <span style="font-weight:normal;color:#666;font-size:11px;">${dowAbbr}</span></div>`;

      if (sorted.length === 0) {
        table += `<span style="color:#aaa;font-size:11px;">—</span>`;
      } else {
        for (const a of sorted) {
          const bg = SHIFT_COLORS[a.shift] ?? '#eee';
          table += `<div style="margin-bottom:3px;">`;
          table += `<span style="background:${bg};padding:1px 5px;border-radius:3px;font-size:11px;display:inline-block;">${SHIFT_LABELS[a.shift]}</span>`;
          table += ` ${escapeHtml(a.name)}`;
          table += `</div>`;
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
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWeekRows(allDays: string[]): (string | null)[][] {
  if (allDays.length === 0) return [];

  const daySet = new Set(allDays);
  const firstDay = fromDateString(allDays[0]!);
  const lastDay = fromDateString(allDays[allDays.length - 1]!);

  // Find Monday of first week
  const cursor = new Date(firstDay);
  const firstDow = cursor.getDay();
  const daysBack = firstDow === 0 ? 6 : firstDow - 1;
  cursor.setDate(cursor.getDate() - daysBack);

  const weeks: (string | null)[][] = [];

  while (cursor <= lastDay) {
    const week: (string | null)[] = [];
    for (let d = 0; d < 5; d++) {
      const dateStr = toDateStr(cursor);
      week.push(daySet.has(dateStr) ? dateStr : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    cursor.setDate(cursor.getDate() + 2); // skip Sat/Sun
    weeks.push(week);
  }

  return weeks;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
