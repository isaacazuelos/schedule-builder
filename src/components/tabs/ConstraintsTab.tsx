import { useApp } from '../../store/AppContext';
import type { ShiftType } from '../../types';
import { ALL_ROLES, ALL_TEAMS, DAILY_SHIFTS, WEEKLY_SHIFTS, SHIFT_LABELS, TEAM_LABELS } from '../../types';

export default function ConstraintsTab() {
  const { state, setSlotCount, setWeeklyCap, setWeeklyTypeCap } = useApp();

  return (
    <div>
      <div className="section">
        <div className="section-title">Shifts per Day</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            How many people are needed for each daily shift type.
          </p>
          <table className="data-table" style={{ width: 'auto' }}>
            <thead>
              <tr>
                <th>Shift</th>
                <th>People per day</th>
              </tr>
            </thead>
            <tbody>
              {DAILY_SHIFTS.map(s => (
                <tr key={s}>
                  <td><span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span></td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={state.slotCounts[s]}
                      onChange={e => setSlotCount(s, Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Weekly Caps per Role & Team</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Maximum shifts per week for each role, split by domestic / international team. Leave per-type caps blank for no limit.
            Check QP columns to allow that role to be assigned as Question Person.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Team</th>
                <th>Max shifts/week</th>
                {DAILY_SHIFTS.map(s => (
                  <th key={s}>
                    <span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span>/week
                  </th>
                ))}
                {WEEKLY_SHIFTS.map(s => (
                  <th key={s}>
                    <span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.flatMap(role => ALL_TEAMS.map(team => {
                const cap = state.weeklyCaps.find(c => c.role === role && c.team === team);
                if (!cap) return null;
                return (
                  <tr key={`${role}-${team}`}>
                    <td>
                      <span className={`badge badge-${role.toLowerCase()}`}>{role}</span>
                    </td>
                    <td>{TEAM_LABELS[team]}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={cap.maxShiftsPerWeek}
                        onChange={e => setWeeklyCap(role, team, Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </td>
                    {DAILY_SHIFTS.map(s => (
                      <td key={s}>
                        <input
                          type="number"
                          min={0}
                          max={25}
                          placeholder="—"
                          value={cap.maxPerType[s] ?? ''}
                          onChange={e => {
                            const val = e.target.value.trim();
                            if (val === '') {
                              setWeeklyTypeCap(role, team, s as ShiftType, null);
                            } else {
                              setWeeklyTypeCap(role, team, s as ShiftType, Math.max(0, parseInt(val) || 0));
                            }
                          }}
                        />
                      </td>
                    ))}
                    {WEEKLY_SHIFTS.map(s => (
                      <td key={s} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={(cap.maxPerType[s] ?? 1) > 0}
                          onChange={e => setWeeklyTypeCap(role, team, s as ShiftType, e.target.checked ? null : 0)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
