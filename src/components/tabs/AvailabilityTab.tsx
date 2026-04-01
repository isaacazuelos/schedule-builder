import { useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../../store/AppContext';
import { parseSharedCalendarCsv, bestStaffMatch } from '../../utils/csvParser';
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

  const allDays = getDaysInMonth(state.targetMonth);

  function isAvailable(staffId: string, date: string): boolean {
    const override = state.overrides.find(o => o.staffId === staffId && o.date === date);
    if (override !== undefined) return override.available;
    const csvDates = state.csvUnavailability[staffId] ?? [];
    return !csvDates.includes(date);
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
      assignedStaffId: bestStaffMatch(event.subject, state.staff),
      dismissed: false,
    }));
    setPendingImport(events);
    e.target.value = '';
  }

  function handleCellClick(staffId: string, date: string) {
    if (isWeekend(date) || isHoliday(date)) return;
    const currently = isAvailable(staffId, date);
    toggleOverride(staffId, date, !currently);
  }

  const ROLE_ORDER: Record<string, number> = { OP2: 0, SA1: 1, SA2: 2 };
  const sortedStaff = [...state.staff].sort((a, b) => {
    const roleCmp = (ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0);
    return roleCmp !== 0 ? roleCmp : a.name.localeCompare(b.name);
  });

  const workdayColumns = allDays.filter(d => !isWeekend(d));

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

      {state.pendingImport && (
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
                    <th>Event</th>
                    <th>Dates</th>
                    <th>Assign to</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.pendingImport.events.map(event => {
                    const sorted = [...event.dates].sort();
                    const first = sorted[0] ?? '';
                    const last = sorted[sorted.length - 1] ?? '';
                    const dateLabel =
                      sorted.length === 1
                        ? first
                        : `${sorted.length} day(s): ${first} – ${last}`;

                    return (
                      <tr key={event.id} style={{ opacity: event.dismissed ? 0.4 : 1 }}>
                        <td style={{ textDecoration: event.dismissed ? 'line-through' : undefined }}>
                          {event.subject || <em className="muted">No subject</em>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{dateLabel}</td>
                        <td>
                          <select
                            value={event.assignedStaffId ?? ''}
                            disabled={event.dismissed}
                            style={{ pointerEvents: event.dismissed ? 'none' : undefined }}
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
                            onClick={() =>
                              updatePendingAssignment(
                                event.id,
                                event.dismissed ? event.assignedStaffId : event.assignedStaffId,
                                !event.dismissed
                              )
                            }
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
            </div>
          </div>
        </div>
      )}

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
          Click a cell to toggle availability. Green = available, Red = unavailable.
          Holidays are grey. Changes here override CSV data for that cell.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 2, minWidth: 130 }}>
                  Staff
                </th>
                {workdayColumns.map(d => (
                  <th
                    key={d}
                    style={{
                      textAlign: 'center',
                      minWidth: 36,
                      fontSize: 11,
                      padding: '6px 2px',
                      background: isHoliday(d) ? '#e9ecef' : 'var(--color-bg)',
                      color: isHoliday(d) ? 'var(--color-text-muted)' : undefined,
                    }}
                    title={d}
                  >
                    <div>{d.slice(8)}</div>
                    <div style={{ fontWeight: 400 }}>{dowLabel(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStaff.map(s => (
                <tr key={s.id}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'var(--color-bg)',
                      zIndex: 1,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                    <span
                      className={`badge badge-${s.role.toLowerCase()} ml-6`}
                      style={{ marginLeft: 6 }}
                    >
                      {s.role}
                    </span>
                  </td>
                  {workdayColumns.map(d => {
                    const holiday = isHoliday(d);
                    const avail = !holiday && isAvailable(s.id, d);
                    const hasOverride = state.overrides.some(o => o.staffId === s.id && o.date === d);
                    let bg = avail ? '#d1e7dd' : '#f8d7da';
                    if (holiday) bg = '#e9ecef';

                    return (
                      <td
                        key={d}
                        style={{
                          background: bg,
                          textAlign: 'center',
                          cursor: holiday ? 'default' : 'pointer',
                          padding: '4px 2px',
                          fontSize: 12,
                          outline: hasOverride ? '2px solid #0d6efd' : undefined,
                          userSelect: 'none',
                        }}
                        title={
                          holiday
                            ? 'Holiday'
                            : `${s.name} — ${d} — ${avail ? 'Available' : 'Unavailable'}${hasOverride ? ' (override)' : ''}`
                        }
                        onClick={() => handleCellClick(s.id, d)}
                      >
                        {holiday ? '—' : avail ? '✓' : '✗'}
                      </td>
                    );
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
