import { useApp } from '../../store/AppContext';
import type { ShiftType } from '../../types';
import { ALL_ROLES, ALL_SHIFTS, DAILY_SHIFTS, WEEKLY_SHIFTS, SHIFT_LABELS } from '../../types';

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
        <div className="section-title">Question Person (QP) per Week</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            How many QP people are assigned each week. Set to 0 to disable. A QP person covers
            that role for the whole week and cannot be assigned other shifts that week.
          </p>
          <table className="data-table" style={{ width: 'auto' }}>
            <thead>
              <tr>
                <th>Shift</th>
                <th>People per week</th>
              </tr>
            </thead>
            <tbody>
              {WEEKLY_SHIFTS.map(s => (
                <tr key={s}>
                  <td><span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span></td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={5}
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
        <div className="section-title">Weekly Caps per Role</div>
        <div className="card">
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Maximum shifts per week for each role. Leave per-type caps blank to apply no per-type limit.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Max shifts/week</th>
                {ALL_SHIFTS.map(s => (
                  <th key={s}>
                    <span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span>/week
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_ROLES.map(role => {
                const cap = state.weeklyCaps.find(c => c.role === role);
                if (!cap) return null;
                return (
                  <tr key={role}>
                    <td>
                      <span className={`badge badge-${role.toLowerCase()}`}>{role}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={25}
                        value={cap.maxShiftsPerWeek}
                        onChange={e =>
                          setWeeklyCap(role, Math.max(0, parseInt(e.target.value) || 0))
                        }
                      />
                    </td>
                    {ALL_SHIFTS.map(s => (
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
                              setWeeklyTypeCap(role, s as ShiftType, null);
                            } else {
                              setWeeklyTypeCap(role, s as ShiftType, Math.max(0, parseInt(val) || 0));
                            }
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
