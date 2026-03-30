import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { exportConfig, importConfig } from '../../utils/exportImport';
import type { Role } from '../../types';
import { ALL_ROLES, ALL_SHIFTS, SHIFT_LABELS } from '../../types';

export default function StaffTab() {
  const { state, addStaff, removeStaff, updateStaffName, updateStaffRole, toggleTrainedShift } = useApp();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('SA1');

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    addStaff(name, newRole);
    setNewName('');
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
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Staff ({state.staff.length})</div>
        {state.staff.length === 0 ? (
          <div className="empty-state">No staff added yet.</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Trained Shifts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.staff.map(s => (
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
            <li><strong>SA1</strong> — all shift types</li>
            <li><strong>SA2</strong> — all shift types</li>
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
    exportConfig({
      staff: state.staff,
      overrides: state.overrides,
      holidays: state.holidays,
      slotCounts: state.slotCounts,
      weeklyCaps: state.weeklyCaps,
      targetMonth: state.targetMonth,
    });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const config = await importConfig(file);
      loadConfig(config);
    } catch (err) {
      alert(`Failed to import config: ${err instanceof Error ? err.message : String(err)}`);
    }
    e.target.value = '';
  }

  return (
    <div className="section">
      <div className="section-title">Config Export / Import</div>
      <div className="card">
        <div className="row">
          <button className="btn btn-secondary" onClick={handleExport}>
            Export Config (JSON)
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            Import Config (JSON)
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
        <p className="muted mt-8" style={{ fontSize: 12 }}>
          Exports staff list, overrides, holidays, slot counts, and weekly caps.
        </p>
      </div>
    </div>
  );
}
