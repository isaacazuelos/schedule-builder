import { useRef } from 'react';
import { useApp } from '../../store/AppContext';
import { parseOutlookCsv } from '../../utils/csvParser';
import { getDaysInMonth, dowLabel, fromDateString } from '../../utils/dateUtils';

export default function AvailabilityTab() {
  const { state, setCsvUnavailability, toggleOverride, toggleHoliday, clearAvailability } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allDays = getDaysInMonth(state.targetMonth);

  // isAvailable computes effective availability for the grid
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
    const files = e.target.files;
    if (!files) return;
    const matched: { name: string; staffId: string }[] = [];

    for (const file of Array.from(files)) {
      const baseName = file.name.replace(/\.csv$/i, '');
      const member = state.staff.find(s =>
        s.name.toLowerCase().includes(baseName.toLowerCase()) ||
        baseName.toLowerCase().includes(s.name.toLowerCase())
      );
      if (!member) {
        alert(`No staff member matched filename "${file.name}". Filename should contain the staff member's name.`);
        continue;
      }
      const text = await file.text();
      const dates = parseOutlookCsv(text);
      setCsvUnavailability(member.id, dates);
      matched.push({ name: member.name, staffId: member.id });
    }

    if (matched.length > 0) {
      alert(`Imported availability for: ${matched.map(m => m.name).join(', ')}`);
    }
    e.target.value = '';
  }

  function handleCellClick(staffId: string, date: string) {
    if (isWeekend(date) || isHoliday(date)) return;
    const currently = isAvailable(staffId, date);
    toggleOverride(staffId, date, !currently);
  }

  const workdayColumns = allDays.filter(d => !isWeekend(d));

  if (state.staff.length === 0) {
    return <div className="empty-state">Add staff members first (Staff tab).</div>;
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Import Outlook CSV</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Export each person's calendar from Outlook as CSV and upload here. The filename must
            contain the staff member's name (e.g. <em>Jane Smith.csv</em> matches "Jane Smith").
          </p>
          <div className="row">
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Upload CSV file(s)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              style={{ display: 'none' }}
              onChange={handleCsvUpload}
            />
          </div>
        </div>
      </div>

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
              {state.staff.map(s => (
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
