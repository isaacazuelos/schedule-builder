import { useApp } from '../../store/AppContext';
import { getWorkdays, formatMonth } from '../../utils/dateUtils';
import { solveSchedule } from '../../utils/ilpSolver';
import { ALL_SHIFTS, SHIFT_LABELS } from '../../types';

export default function GenerateTab() {
  const { state, setTargetMonth, setSolveStatus, setSchedule, setTab } = useApp();

  const workdays = getWorkdays(state.targetMonth, state.holidays);

  function handleGenerate() {
    if (state.staff.length === 0) {
      alert('Add staff members first.');
      return;
    }
    if (workdays.length === 0) {
      alert('No workdays in the selected month.');
      return;
    }

    setSolveStatus('solving');

    // Defer to allow "solving" state to render
    setTimeout(() => {
      try {
        // Build unavailability map: staffId -> Set<date>
        const unavailMap = new Map<string, Set<string>>();
        for (const s of state.staff) {
          const unavail = new Set<string>();
          const csvDates = state.csvUnavailability[s.id] ?? [];
          for (const d of csvDates) unavail.add(d);
          // Apply overrides
          for (const o of state.overrides) {
            if (o.staffId !== s.id) continue;
            if (o.available) unavail.delete(o.date);
            else unavail.add(o.date);
          }
          unavailMap.set(s.id, unavail);
        }

        const schedule = solveSchedule(
          state.staff,
          workdays,
          state.slotCounts,
          state.weeklyCaps,
          unavailMap
        );

        setSchedule(schedule);

        if (schedule.status === 'optimal') {
          setTab('calendar');
        }
      } catch (e) {
        setSchedule({
          month: state.targetMonth,
          assignments: {},
          status: 'error',
          message: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }, 50);
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Target Month</div>
        <div className="card">
          <div className="row">
            <label>
              Month:
              <input
                type="month"
                value={state.targetMonth}
                onChange={e => setTargetMonth(e.target.value)}
              />
            </label>
          </div>
          <p className="muted mt-8" style={{ fontSize: 13 }}>
            {workdays.length} workday(s) in {formatMonth(state.targetMonth)}
            {state.holidays.length > 0 ? ` (${state.holidays.length} holiday(s) excluded)` : ''}
          </p>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Summary</div>
        <div className="card">
          <table className="data-table" style={{ width: 'auto' }}>
            <tbody>
              <tr><td>Staff members</td><td><strong>{state.staff.length}</strong></td></tr>
              <tr><td>Workdays</td><td><strong>{workdays.length}</strong></td></tr>
              {ALL_SHIFTS.map(s => (
                <tr key={s}>
                  <td><span className={`shift-chip shift-${s}`}>{SHIFT_LABELS[s]}</span> slots/day</td>
                  <td><strong>{state.slotCounts[s]}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {state.solveStatus === 'solving' && (
        <div className="status-banner status-banner--info">
          Solving… this may take a moment for large schedules.
        </div>
      )}

      {state.schedule && state.schedule.status === 'optimal' && (
        <div className="status-banner status-banner--success">
          Schedule generated successfully for {formatMonth(state.schedule.month)}.
          View it in the <strong>Shift Calendar</strong> or <strong>Output</strong> tab.
        </div>
      )}

      {state.schedule && state.schedule.status === 'infeasible' && (
        <div className="status-banner status-banner--error">
          <strong>Infeasible:</strong> {state.schedule.message}
        </div>
      )}

      {state.schedule && state.schedule.status === 'error' && (
        <div className="status-banner status-banner--error">
          <strong>Error:</strong> {state.schedule.message}
        </div>
      )}

      <div className="section">
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={state.solveStatus === 'solving' || state.staff.length === 0}
          style={{ fontSize: 15, padding: '10px 28px' }}
        >
          {state.solveStatus === 'solving' ? 'Solving…' : 'Generate Schedule'}
        </button>
      </div>
    </div>
  );
}
