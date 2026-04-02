import { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store/AppContext';
import { parseSharedCalendarCsv, bestStaffMatch, findMatchInSubject } from '../../utils/csvParser';
import { getDaysInMonth, dowLabel, fromDateString } from '../../utils/dateUtils';

export default function AvailabilityTab() {
  const {
    state,
    toggleOverride,
    toggleHoliday,
    clearAvailability,
    setPendingImport,
    updatePendingAssignment,
    confirmPendingImport,
    cancelPendingImport,
  } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  type SortCol = 'subject' | 'date' | 'blocked' | 'assignee';
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSortClick(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }
  const sortArrow = (col: SortCol) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const allDays = getDaysInMonth(state.targetMonth);

  function isAvailable(staffId: string, date: string, period: 'am' | 'pm'): boolean {
    const override = state.overrides.find(
      o => o.staffId === staffId && o.date === date && o.period === period
    );
    if (override !== undefined) return override.available;
    const block = state.csvUnavailability[staffId]?.[date];
    if (!block) return true;
    if (block === 'both') return false;
    return block !== period;
  }

  function isWeekend(date: string): boolean {
    const dow = fromDateString(date).getDay();
    return dow === 0 || dow === 6;
  }

  function isHoliday(date: string): boolean {
    return state.holidays.includes(date);
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseSharedCalendarCsv(text);
    const events = parsed.map(event => ({
      id: uuidv4(),
      subject: event.subject,
      dates: event.dates,
      blocked: event.blocked,
      assignedStaffId: bestStaffMatch(event.subject, state.staff),
      dismissed: false,
    }));
    setPendingImport(events);
    e.target.value = '';
  }

  function handleCellClick(staffId: string, date: string, period: 'am' | 'pm') {
    if (isWeekend(date) || isHoliday(date)) return;
    const currently = isAvailable(staffId, date, period);
    toggleOverride(staffId, date, period, !currently);
  }

  const workdayColumns = allDays.filter(d => !isWeekend(d));

  const ROLE_ORDER: Record<string, number> = { OP2: 0, SA1: 1, SA2: 2 };
  const sortedStaff = [...state.staff].sort((a, b) => {
    const roleCmp = (ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0);
    return roleCmp !== 0 ? roleCmp : a.name.localeCompare(b.name);
  });

  if (state.staff.length === 0) {
    return <div className="empty-state">Add staff members first (Staff tab).</div>;
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Import Shared Calendar CSV</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Export your team's shared Outlook calendar as a single CSV. Events whose names
            contain a staff member's name will be suggested as unavailability for that person.
            You can review and adjust assignments before confirming.
          </p>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Upload shared calendar CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCsvUpload}
            />
          </div>
        </div>
      </div>

      {state.pendingImport && (() => {
        const staffById = Object.fromEntries(state.staff.map(s => [s.id, s]));

        const sortedEvents = [...state.pendingImport.events].sort((a, b) => {
          let cmp = 0;
          if (sortCol === 'subject') {
            cmp = a.subject.toLowerCase().localeCompare(b.subject.toLowerCase());
          } else if (sortCol === 'date') {
            cmp = ([...a.dates].sort()[0] ?? '').localeCompare([...b.dates].sort()[0] ?? '');
          } else if (sortCol === 'blocked') {
            cmp = a.blocked.localeCompare(b.blocked);
          } else {
            const aName = (staffById[a.assignedStaffId ?? '']?.name ?? '').toLowerCase();
            const bName = (staffById[b.assignedStaffId ?? '']?.name ?? '').toLowerCase();
            cmp = aName.localeCompare(bName);
          }
          return sortDir === 'asc' ? cmp : -cmp;
        });

        function renderSubject(subject: string, assignedStaffId: string | null) {
          if (!subject) return <em className="muted">No subject</em>;
          const staffName = staffById[assignedStaffId ?? '']?.name;
          if (!staffName) return <>{subject}</>;
          const m = findMatchInSubject(subject, staffName);
          if (!m) return <>{subject}</>;
          return (
            <>
              {subject.slice(0, m.start)}
              <mark style={{ background: '#fff3cd', padding: '0 1px', borderRadius: 2 }}>
                {subject.slice(m.start, m.end)}
              </mark>
              {subject.slice(m.end)}
            </>
          );
        }

        const thStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

        return (
          <div className="section">
            <div className="section-title">Review Import</div>
            <div className="card">
              <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                Each event has been matched to the most similar staff name. Adjust assignments
                as needed, then confirm to apply.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={thStyle} onClick={() => handleSortClick('subject')}>Event{sortArrow('subject')}</th>
                      <th style={thStyle} onClick={() => handleSortClick('date')}>Dates{sortArrow('date')}</th>
                      <th style={thStyle} onClick={() => handleSortClick('blocked')}>Blocks{sortArrow('blocked')}</th>
                      <th style={thStyle} onClick={() => handleSortClick('assignee')}>Assign to{sortArrow('assignee')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEvents.map(event => {
                      const sorted = [...event.dates].sort();
                      const first = sorted[0] ?? '';
                      const last = sorted[sorted.length - 1] ?? '';
                      const dateLabel = sorted.length === 1 ? first : `${sorted.length} days: ${first} – ${last}`;

                      return (
                        <tr key={event.id} style={{ opacity: event.dismissed ? 0.4 : 1 }}>
                          <td style={{ textDecoration: event.dismissed ? 'line-through' : undefined }}>
                            {renderSubject(event.subject, event.dismissed ? null : event.assignedStaffId)}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{dateLabel}</td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                            {event.blocked === 'am' ? 'AM only' : event.blocked === 'pm' ? 'PM only' : 'AM + PM'}
                          </td>
                          <td>
                            <select
                              value={event.assignedStaffId ?? ''}
                              disabled={event.dismissed}
                              onChange={e => {
                                const val = e.target.value;
                                updatePendingAssignment(event.id, val === '' ? null : val, false);
                              }}
                            >
                              <option value="">— Nobody (ignore) —</option>
                              {sortedStaff.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => updatePendingAssignment(event.id, event.assignedStaffId, !event.dismissed)}
                            >
                              {event.dismissed ? 'Restore' : 'Dismiss'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={confirmPendingImport}>
                  Confirm import
                </button>
                <button className="btn btn-secondary" onClick={cancelPendingImport}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setPendingImport(state.pendingImport!.events.map(e => ({ ...e, dismissed: true })))}
                >
                  Dismiss all
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="section">
        <div className="section-title">Holidays</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Click any workday column header to toggle it as a holiday (excluded from scheduling).
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {workdayColumns.map(d => (
              <button
                key={d}
                className={`btn btn-sm ${state.holidays.includes(d) ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => toggleHoliday(d)}
                title={d}
              >
                {d.slice(5)} {/* MM-DD */}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Availability Grid</div>
          <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Clear all CSV imports and manual overrides?')) clearAvailability(); }}>
            Reset availability
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Click a cell to toggle availability for that AM or PM period.
          Green = available, Red = unavailable. Holidays are grey. Blue outline = manual override.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  style={{ position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 2, minWidth: 130 }}
                >
                  Staff
                </th>
                {workdayColumns.map((d, dateIdx) => (
                  <th
                    key={d}
                    colSpan={2}
                    className={dateIdx % 2 === 1 ? 'col-even' : undefined}
                    style={{
                      textAlign: 'center',
                      fontSize: 11,
                      padding: '4px 2px 2px',
                      background: isHoliday(d) ? '#e9ecef' : 'var(--color-bg)',
                      color: isHoliday(d) ? 'var(--color-text-muted)' : undefined,
                      borderBottom: 0,
                    }}
                    title={d}
                  >
                    <div>{d.slice(8)}</div>
                    <div style={{ fontWeight: 400 }}>{dowLabel(d)}</div>
                  </th>
                ))}
              </tr>
              <tr>
                {workdayColumns.map((d, dateIdx) =>
                  (['am', 'pm'] as const).map(period => (
                    <th
                      key={`${d}-${period}`}
                      className={dateIdx % 2 === 1 ? 'col-even' : undefined}
                      style={{
                        textAlign: 'center',
                        fontSize: 10,
                        padding: '2px',
                        minWidth: 24,
                        background: isHoliday(d) ? '#e9ecef' : 'var(--color-bg)',
                        color: isHoliday(d) ? 'var(--color-text-muted)' : 'var(--color-text-muted)',
                        fontWeight: 400,
                        borderTop: 0,
                      }}
                    >
                      {period.toUpperCase()}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map(s => (
                <tr key={s.id}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--row-bg, var(--color-bg))',
                      zIndex: 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                    <span className={`badge badge-${s.role.toLowerCase()} ml-6`} style={{ marginLeft: 6 }}>
                      {s.role}
                    </span>
                  </td>
                  {workdayColumns.map((d, dateIdx) => {
                    const holiday = isHoliday(d);
                    return (['am', 'pm'] as const).map(period => {
                      const avail = !holiday && isAvailable(s.id, d, period);
                      const hasOverride = state.overrides.some(
                        o => o.staffId === s.id && o.date === d && o.period === period
                      );
                      let bg = avail ? 'var(--cell-avail)' : 'var(--cell-unavail)';
                      if (holiday) bg = 'var(--cell-holiday)';

                      return (
                        <td
                          key={`${d}-${period}`}
                          className={dateIdx % 2 === 1 ? 'col-even' : undefined}
                          style={{
                            background: bg,
                            textAlign: 'center',
                            cursor: holiday ? 'default' : 'pointer',
                            padding: '4px 1px',
                            fontSize: 11,
                            outline: hasOverride ? '2px solid #0d6efd' : undefined,
                            userSelect: 'none',
                          }}
                          title={
                            holiday
                              ? 'Holiday'
                              : `${s.name} — ${d} ${period.toUpperCase()} — ${avail ? 'Available' : 'Unavailable'}${hasOverride ? ' (override)' : ''}`
                          }
                          onClick={() => handleCellClick(s.id, d, period)}
                        >
                          {holiday ? '—' : avail ? '✓' : '✗'}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
