/**
 * ILP solver for the phone coverage schedule.
 *
 * Model (minimax fairness):
 *   Minimize M
 *   Subject to:
 *     Coverage:        for each workday d, shift s: sum_i x[i,d,s] = slots[s]
 *     One shift/day:   for each i, d:               sum_s x[i,d,s] <= 1
 *     Weekly total:    for each i, week w:           sum_{d in w, s} x[i,d,s] <= cap[role_i]
 *     Weekly per-type: for each i, s, week w:        sum_{d in w} x[i,d,s] <= typeCap[role_i][s]
 *     Minimax:         for each i:                   sum_{d,s} x[i,d,s] - M <= 0
 *     x[i,d,s] in {0,1}, M >= 0 integer
 *
 * Uses javascript-lp-solver (pure JS ILP).
 *
 * If the model is infeasible the solver returns feasible=false.
 */

import solver from 'javascript-lp-solver';

import type {
  StaffMember,
  ShiftType,
  SlotCounts,
  WeeklyCap,
  AssignmentMap,
  Schedule,
  SolveStatus,
} from '../types';
import { ALL_SHIFTS } from '../types';
import { groupByWeek } from './dateUtils';


export function solveSchedule(
  staff: StaffMember[],
  workdays: string[],
  slotCounts: SlotCounts,
  weeklyCaps: WeeklyCap[],
  /** staffId -> set of unavailable dates */
  unavailableDates: Map<string, Set<string>>
): Schedule {
  const month = workdays[0]?.substring(0, 7) ?? '';

  if (staff.length === 0 || workdays.length === 0) {
    return { month, assignments: {}, status: 'infeasible', message: 'No staff or no workdays.' };
  }

  const weeks = groupByWeek(workdays);
  const constraints: Record<string, { min?: number; max?: number; equal?: number }> = {};
  const variables: Record<string, Record<string, number>> = {};
  const ints: Record<string, 1> = {};

  // M is the objective variable (max total shifts for any person — minimize this)
  variables['M'] = { objective: 1 };
  // M is a non-negative integer; no upper bound needed in practice
  constraints['M_lb'] = { min: 0 };
  variables['M']['M_lb'] = 1;

  // Build coverage constraint names
  for (const d of workdays) {
    for (const s of ALL_SHIFTS) {
      const slots = slotCounts[s];
      if (slots === 0) continue;
      constraints[covKey(d, s)] = { equal: slots };
    }
  }

  // One-shift-per-day constraints
  for (const i of staff) {
    for (const d of workdays) {
      constraints[dayKey(i.id, d)] = { max: 1 };
    }
  }

  // Weekly total cap constraints
  for (const i of staff) {
    const cap = weeklyCaps.find(c => c.role === i.role);
    if (!cap) continue;
    for (let w = 0; w < weeks.length; w++) {
      constraints[weekCapKey(i.id, w)] = { max: cap.maxShiftsPerWeek };
    }
  }

  // Weekly per-type cap constraints
  for (const i of staff) {
    const cap = weeklyCaps.find(c => c.role === i.role);
    if (!cap) continue;
    for (const s of ALL_SHIFTS) {
      const typeMax = cap.maxPerType[s];
      if (typeMax === undefined) continue;
      for (let w = 0; w < weeks.length; w++) {
        constraints[typeCapKey(i.id, s, w)] = { max: typeMax };
      }
    }
  }

  // Minimax constraints: sum_{d,s} x[i,d,s] - M <= 0 for each person i
  for (const i of staff) {
    constraints[minimaxKey(i.id)] = { max: 0 };
    // M gets coefficient -1 in person i's minimax constraint
    variables['M'][minimaxKey(i.id)] = -1;
  }

  // Add decision variables x[i,d,s] for eligible assignments
  const cap = weeklyCaps;
  for (const i of staff) {
    const roleCap = cap.find(c => c.role === i.role);
    const unavail = unavailableDates.get(i.id) ?? new Set();

    for (let di = 0; di < workdays.length; di++) {
      const d = workdays[di]!;
      if (unavail.has(d)) continue;

      // Find which week this day belongs to
      const weekIdx = weeks.findIndex(w => w.includes(d));

      for (const s of ALL_SHIFTS) {
        if (!i.trainedShifts.includes(s)) continue;
        if (slotCounts[s] === 0) continue;

        const varName = xKey(i.id, di, s);
        const v: Record<string, number> = {};

        // Coverage
        v[covKey(d, s)] = 1;

        // One shift per day
        v[dayKey(i.id, d)] = 1;

        // Weekly total cap
        if (roleCap && weekIdx !== -1) {
          v[weekCapKey(i.id, weekIdx)] = 1;
        }

        // Weekly per-type cap
        if (roleCap && weekIdx !== -1 && roleCap.maxPerType[s] !== undefined) {
          v[typeCapKey(i.id, s, weekIdx)] = 1;
        }

        // Minimax
        v[minimaxKey(i.id)] = 1;

        variables[varName] = v;
        ints[varName] = 1;
      }
    }
  }

  // Run solver
  let result: { feasible: boolean; result: number; [k: string]: number | boolean };
  try {
    result = solver.Solve({
      optimize: 'objective',
      opType: 'min',
      constraints,
      variables,
      ints,
    });
  } catch (e) {
    return {
      month,
      assignments: {},
      status: 'error',
      message: `Solver error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (!result.feasible) {
    return {
      month,
      assignments: {},
      status: 'infeasible',
      message:
        'No feasible schedule found. Coverage requirements may exceed available trained staff after applying availability and caps.',
    };
  }

  // Extract assignments
  const assignments: AssignmentMap = {};
  for (const i of staff) assignments[i.id] = {};

  for (let di = 0; di < workdays.length; di++) {
    const d = workdays[di]!;
    for (const i of staff) {
      for (const s of ALL_SHIFTS) {
        const varName = xKey(i.id, di, s);
        if (result[varName] === 1) {
          assignments[i.id]![d] = s;
        }
      }
    }
  }

  let status: SolveStatus = 'optimal';
  if (!result.feasible) status = 'infeasible';

  return { month, assignments, status };
}

// ─── Key helpers ─────────────────────────────────────────────────────────────

function covKey(date: string, shift: ShiftType): string {
  return `cov__${date}__${shift}`;
}

function dayKey(staffId: string, date: string): string {
  return `day__${staffId}__${date}`;
}

function weekCapKey(staffId: string, weekIdx: number): string {
  return `wcap__${staffId}__${weekIdx}`;
}

function typeCapKey(staffId: string, shift: ShiftType, weekIdx: number): string {
  return `tcap__${staffId}__${shift}__${weekIdx}`;
}

function minimaxKey(staffId: string): string {
  return `mmax__${staffId}`;
}

function xKey(staffId: string, dateIdx: number, shift: ShiftType): string {
  return `x__${staffId}__${dateIdx}__${shift}`;
}
