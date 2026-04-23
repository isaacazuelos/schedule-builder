/**
 * Greedy scheduler for phone coverage.
 *
 * Phase 1 – QP (weekly):
 *   For each week, assigns one QP-AM and one QP-PM person (if configured).
 *   A QP person must be available (for that period) on ALL workdays of the week.
 *   QP people are blocked from all daily shifts that week.
 *   QP assignments are stored on the Sunday of each work-week.
 *
 * Phase 2 – Daily shifts:
 *   For each workday and daily-shift slot, picks from eligible staff with the
 *   fewest total shifts (minimax-greedy). Ties broken by: fewest remaining
 *   available days, then role preference (OP2 > SA1 > SA2), then random.
 *   Eligibility respects per-period AM/PM availability.
 *
 * Time complexity: O(weeks × staff + days × shifts × staff) — effectively instant.
 */

import type {
  StaffMember,
  ShiftType,
  SlotCounts,
  WeeklyCap,
  AssignmentMap,
  Schedule,
} from '../types';
import { ALL_SHIFTS, ALL_ROLES, DAILY_SHIFTS, WEEKLY_SHIFTS, SHIFT_LABELS } from '../types';
import { groupByWeek, getSundayOfWeek } from './dateUtils';

/** Per-staff AM/PM unavailability maps (derived from CSV + overrides in the caller). */
export type UnavailMap = Map<string, { am: Set<string>; pm: Set<string> }>;

function getPeriod(shift: ShiftType): 'am' | 'pm' {
  return shift.endsWith('-am') ? 'am' : 'pm';
}

/** True if person is not QP-blocked and not unavailable for the entire day. */
function isAvailableOnDay(
  staffId: string,
  date: string,
  weekIdx: number,
  qpBlockedByWeek: Set<string>[],
  unavailable: UnavailMap,
): boolean {
  if (qpBlockedByWeek[weekIdx]!.has(staffId)) return false;
  const unavail = unavailable.get(staffId);
  return !(unavail && unavail.am.has(date) && unavail.pm.has(date));
}

/**
 * Pick from candidates with the fewest shifts.
 * Tiebreakers: 1) fewest remaining available days, 2) role (OP2 > SA1 > SA2), 3) random.
 */
function pickCandidate(
  candidates: StaffMember[],
  totalShifts: Record<string, number>,
  remainingDays?: Record<string, number>,
): StaffMember {
  const minCount = Math.min(...candidates.map(s => totalShifts[s.id]!));
  let tied = candidates.filter(s => totalShifts[s.id] === minCount);
  if (remainingDays && tied.length > 1) {
    const fewest = Math.min(...tied.map(s => remainingDays[s.id]!));
    tied = tied.filter(s => remainingDays[s.id] === fewest);
  }
  const bestRoleIdx = Math.min(...tied.map(s => ALL_ROLES.indexOf(s.role)));
  const preferred = tied.filter(s => ALL_ROLES.indexOf(s.role) === bestRoleIdx);
  return preferred[Math.floor(Math.random() * preferred.length)]!;
}

export function solveSchedule(
  staff: StaffMember[],
  workdays: string[],
  slotCounts: SlotCounts,
  weeklyCaps: WeeklyCap[],
  unavailable: UnavailMap,
): Schedule {
  const month = workdays[0]?.substring(0, 7) ?? '';

  if (staff.length === 0 || workdays.length === 0) {
    return { month, assignments: {}, status: 'infeasible', message: 'No staff or no workdays.' };
  }

  const weeks = groupByWeek(workdays);

  // Index week membership for fast lookup: date -> weekIdx
  const dateToWeekIdx = new Map<string, number>();
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]!) dateToWeekIdx.set(d, w);
  }

  // Running counters
  const totalShifts: Record<string, number> = {};
  const weeklyShifts: Record<string, number[]> = {};
  const weeklyTypeShifts: Record<string, Record<ShiftType, number>[]> = {};

  for (const s of staff) {
    totalShifts[s.id] = 0;
    weeklyShifts[s.id] = Array(weeks.length).fill(0);
    weeklyTypeShifts[s.id] = Array.from({ length: weeks.length }, () =>
      Object.fromEntries(ALL_SHIFTS.map(sh => [sh, 0])) as Record<ShiftType, number>
    );
  }

  const assignments: AssignmentMap = {};
  for (const s of staff) assignments[s.id] = {};

  // staffId -> date already has an assignment (one shift per day, daily shifts only)
  const assignedOnDay: Record<string, Set<string>> = {};
  for (const d of workdays) assignedOnDay[d] = new Set();

  // ── Phase 1: assign QP for each week ────────────────────────────────────────
  // qpBlockedByWeek[weekIdx] = set of staffIds blocked from daily shifts this week
  const qpBlockedByWeek: Set<string>[] = Array.from({ length: weeks.length }, () => new Set());

  for (let w = 0; w < weeks.length; w++) {
    const weekDays = weeks[w]!;
    const sunday = getSundayOfWeek(weekDays[0]!);

    for (const qpShift of WEEKLY_SHIFTS) {
      const count = slotCounts[qpShift];
      if (count === 0) continue;

      const period = getPeriod(qpShift);

      for (let slot = 0; slot < count; slot++) {
        const candidates = staff.filter(s => {
          if (!s.trainedShifts.includes(qpShift)) return false;
          if (qpBlockedByWeek[w]!.has(s.id)) return false;

          // Must be available for all workdays of the week (for the relevant period)
          const unavail = unavailable.get(s.id);
          if (unavail) {
            const unavailSet = period === 'am' ? unavail.am : unavail.pm;
            if (weekDays.some(d => unavailSet.has(d))) return false;
          }

          const cap = weeklyCaps.find(c => c.role === s.role);
          if (cap && weeklyShifts[s.id]![w]! >= cap.maxShiftsPerWeek) return false;

          return true;
        });

        if (candidates.length === 0) {
          return {
            month,
            assignments: {},
            status: 'infeasible',
            message: `Could not assign ${SHIFT_LABELS[qpShift]} for week of ${sunday}.`,
          };
        }

        const chosen = pickCandidate(candidates, totalShifts);

        assignments[chosen.id]![sunday] = qpShift;
        qpBlockedByWeek[w]!.add(chosen.id);
        totalShifts[chosen.id]! += 5;
        weeklyShifts[chosen.id]![w]! += 5;
        weeklyTypeShifts[chosen.id]![w]![qpShift] += 5;
      }
    }
  }

  // ── Phase 2: assign daily shifts ─────────────────────────────────────────────
  // Count remaining available workdays per person (not QP-blocked, not unavailable for either period).
  const remainingDays: Record<string, number> = {};
  for (const s of staff) {
    remainingDays[s.id] = workdays.filter(d =>
      isAvailableOnDay(s.id, d, dateToWeekIdx.get(d) ?? 0, qpBlockedByWeek, unavailable)
    ).length;
  }

  for (const d of workdays) {
    const weekIdx = dateToWeekIdx.get(d) ?? 0;

    for (const shift of DAILY_SHIFTS) {
      const slots = slotCounts[shift];
      if (slots === 0) continue;

      const period = getPeriod(shift);
      const chosenForSlot = new Set<string>();

      for (let slot = 0; slot < slots; slot++) {
        const candidates = staff.filter(s => {
          if (!s.trainedShifts.includes(shift)) return false;
          if (qpBlockedByWeek[weekIdx]!.has(s.id)) return false;
          if (assignedOnDay[d]!.has(s.id)) return false;
          if (chosenForSlot.has(s.id)) return false;

          const unavail = unavailable.get(s.id);
          if (unavail) {
            const unavailSet = period === 'am' ? unavail.am : unavail.pm;
            if (unavailSet.has(d)) return false;
          }

          const cap = weeklyCaps.find(c => c.role === s.role);
          if (cap) {
            if (weeklyShifts[s.id]![weekIdx]! >= cap.maxShiftsPerWeek) return false;
            const typeMax = cap.maxPerType[shift];
            if (typeMax !== undefined && weeklyTypeShifts[s.id]![weekIdx]![shift] >= typeMax) return false;
          }

          return true;
        });

        if (candidates.length === 0) {
          return {
            month,
            assignments: {},
            status: 'infeasible',
            message:
              `Could not fill ${shift} on ${d} (slot ${slot + 1} of ${slots}). ` +
              `Coverage requirements may exceed available trained staff after applying availability and caps.`,
          };
        }

        const chosen = pickCandidate(candidates, totalShifts, remainingDays);

        assignments[chosen.id]![d] = shift;
        assignedOnDay[d]!.add(chosen.id);
        chosenForSlot.add(chosen.id);
        totalShifts[chosen.id]!++;
        weeklyShifts[chosen.id]![weekIdx]!++;
        weeklyTypeShifts[chosen.id]![weekIdx]![shift]++;
      }
    }

    for (const s of staff) {
      if (isAvailableOnDay(s.id, d, weekIdx, qpBlockedByWeek, unavailable)) {
        remainingDays[s.id]!--;
      }
    }
  }

  return { month, assignments, status: 'optimal' };
}
