import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import type { Role, ShiftType } from '../../types';
import { ALL_ROLES, ALL_SHIFTS, SHIFT_LABELS, DEFAULT_TRAINED_BY_ROLE } from '../../types';
import { v4 as uuidv4 } from 'uuid';

type SortCol = 'name' | 'role' | 'team' | 'shifts';
type SortDir = 'asc' | 'desc';

const ROLE_ORDER: Record<string, number> = { OP2: 0, SA1: 1, SA2: 2 };

export default function StaffTab() {
  const { state, addStaff, removeStaff, updateStaffName, updateStaffRole, toggleStaffInternational, toggleTrainedShift, clearAllStaff } = useApp();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('SA1');
  const [newIsInternational, setNewIsInternational] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  const sortedStaff = sortCol === null ? state.staff : [...state.staff].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortCol === 'role') cmp = (ROLE_ORDER[a.role] ?? 0) - (ROLE_ORDER[b.role] ?? 0);
    else if (sortCol === 'team') cmp = Number(a.isInternational) - Number(b.isInternational);
    else if (sortCol === 'shifts') cmp = a.trainedShifts.length - b.trainedShifts.length;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addStaff(name, newRole, newIsInternational);
    setNewName('');
    setNewIsInternational(false);
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Add Staff Member</div>
        <div className="card">
          <div className="row">
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ width: 220 }}
            />
            <select value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
              {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={newIsInternational}
                onChange={e => setNewIsInternational(e.target.checked)}
              />
              International team
            </label>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Staff ({state.staff.length})</div>
          {state.staff.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => { if (confirm('Remove all staff?')) clearAllStaff(); }}>
              Clear all
            </button>
          )}
        </div>
        {state.staff.length === 0 ? (
          <div className="empty-state">No staff added yet.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {(['name', 'role', 'team', 'shifts'] as SortCol[]).map(col => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col === 'name' ? 'Name' : col === 'role' ? 'Role' : col === 'team' ? 'Intl' : 'Trained Shifts'}
                      {sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedStaff.map(s => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="text"
                        value={s.name}
                        onChange={e => updateStaffName(s.id, e.target.value)}
                        style={{ width: 180, border: 'none', background: 'transparent', fontSize: 13 }}
                      />
                    </td>
                    <td>
                      <select
                        value={s.role}
                        onChange={e => updateStaffRole(s.id, e.target.value as Role)}
                      >
                        {ALL_ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={s.isInternational}
                        onChange={() => toggleStaffInternational(s.id)}
                        title="On the international team"
                      />
                    </td>
                    <td>
                      <div className="row" style={{ gap: 12 }}>
                        {ALL_SHIFTS.map(sh => (
                          <label key={sh}>
                            <input
                              type="checkbox"
                              checked={s.trainedShifts.includes(sh)}
                              onChange={() => toggleTrainedShift(s.id, sh)}
                            />
                            <span className={`shift-chip shift-${sh}`}>{SHIFT_LABELS[sh]}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => removeStaff(s.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-title">Role Defaults</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
            When a new staff member is added, their trained shifts are pre-filled based on their role:
          </p>
          <ul className="muted" style={{ fontSize: 13, marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
            <li><strong>OP2</strong> — Phones AM, Phones PM</li>
            <li><strong>SA1</strong> — all shift types (including QP AM, QP PM)</li>
            <li><strong>SA2</strong> — all shift types (including QP AM, QP PM)</li>
          </ul>
          <p className="muted mt-8" style={{ fontSize: 13 }}>
            You can override individual checkboxes above after adding a person.
          </p>
        </div>
      </div>

      <ConfigSection />
    </div>
  );
}

function ConfigSection() {
  const { state, loadConfig } = useApp();

  function handleExport() {
    const headers = ['Name', 'Role', 'International Team', ...ALL_SHIFTS.map(s => SHIFT_LABELS[s])];
    const rows = state.staff.map(s =>
      [s.name, s.role, s.isInternational ? '1' : '0', ...ALL_SHIFTS.map(sh => s.trainedShifts.includes(sh) ? '1' : '0')]
    );
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV has no data rows.');

      const headers = parseCsvRow(lines[0]!).map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const roleIdx = headers.indexOf('role');
      if (nameIdx === -1 || roleIdx === -1) throw new Error('CSV must have Name and Role columns.');

      const shiftColMap: { idx: number; shift: ShiftType }[] = ALL_SHIFTS.flatMap(sh => {
        const idx = headers.indexOf(SHIFT_LABELS[sh].toLowerCase());
        return idx !== -1 ? [{ idx, shift: sh }] : [];
      });
      const intlIdx = headers.indexOf('international team');

      const importedStaff = [];
      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvRow(lines[i]!);
        const name = row[nameIdx]?.trim() ?? '';
        const role = row[roleIdx]?.trim().toUpperCase() as Role;
        if (!name || !ALL_ROLES.includes(role)) continue;
        const trainedShifts: ShiftType[] = shiftColMap.length > 0
          ? shiftColMap.filter(({ idx }) => isTruthy(row[idx])).map(({ shift }) => shift)
          : [...DEFAULT_TRAINED_BY_ROLE[role]];
        const isInternational = intlIdx !== -1 && isTruthy(row[intlIdx]);
        importedStaff.push({ id: uuidv4(), name, role, trainedShifts, isInternational });
      }

      loadConfig({
        staff: importedStaff,
        overrides: state.overrides,
        roleOverrides: state.roleOverrides,
        holidays: state.holidays,
        slotCounts: state.slotCounts,
        weeklyCaps: state.weeklyCaps,
        targetMonth: state.targetMonth,
      });
    } catch (err) {
      alert(`Failed to import: ${err instanceof Error ? err.message : String(err)}`);
    }
    e.target.value = '';
  }

  return (
    <div className="section">
      <div className="section-title">Staff Export / Import</div>
      <div className="card">
        <div className="row">
          <button className="btn btn-secondary" onClick={handleExport} disabled={state.staff.length === 0}>
            Export Staff (CSV)
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            Import Staff (CSV)
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
        <p className="muted mt-8" style={{ fontSize: 12 }}>
          CSV columns: Name, Role, International Team (1 = international, 0 = domestic), and one column per shift type (1 = trained, 0 = not). Importing replaces the current staff list.
        </p>
      </div>
    </div>
  );
}

function isTruthy(v: string | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === '1' || s === 'yes' || s === 'true' || s === 'x';
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(field); field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}
