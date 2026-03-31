/**
 * Greedy scheduler for phone coverage.
 *
 * For each workday and shift slot, picks randomly from the eligible staff who
 * currently have the fewest total shifts assigned (minimax-greedy).
 *
 * Time complexity: O(days × shifts × staff) — effectively instant.
 *
 * Trade-off vs ILP:
 *   - Quality: usually optimal or within 1 shift of the minimax optimum.
 *   - Feasibility: greedy can report infeasible when a solution actually exists
 *     if earlier choices block later coverage. ILP never has this problem.
 *     In a well-staffed office (several trained people per shift type) this
 *     is unlikely in practice.
 */

import type {
  StaffMember,
  ShiftType,
  SlotCounts,
  WeeklyCap,
  AssignmentMap,
  Schedule,
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

  // Index week membership for fast lookup: date -> weekIdx
  const dateToWeekIdx = new Map<string, number>();
  for (let w = 0; w < weeks.length; w++) {
    for (const d of weeks[w]!) dateToWeekIdx.set(d, w);
  }

  // Running counters
  const totalShifts: Record<string, number> = {};
  const weeklyShifts: Record<string, number[]> = {};       // staffId -> weekIdx -> count
  const weeklyTypeShifts: Record<string, Record<ShiftType, number>[]> = {}; // staffId -> weekIdx -> shift -> count

  for (const s of staff) {
    totalShifts[s.id] = 0;
    weeklyShifts[s.id] = Array(weeks.length).fill(0);
    weeklyTypeShifts[s.id] = Array.from({ length: weeks.length }, () => ({
      'phones-am': 0, 'phones-pm': 0, 'inperson-am': 0, 'inperson-pm': 0,
    }));
  }

  const assignments: AssignmentMap = {};
  for (const s of staff) assignments[s.id] = {};

  // staffId -> date already has an assignment (one shift per day)
  const assignedOnDay: Record<string, Set<string>> = {};

  for (const d of workdays) {
    assignedOnDay[d] = new Set();
    const weekIdx = dateToWeekIdx.get(d) ?? 0;

    for (const shift of ALL_SHIFTS) {
      const slots = slotCounts[shift];
      if (slots === 0) continue;

      // Already chosen for this shift on this day (can't assign same person twice)
      const chosenForSlot = new Set<string>();

      for (let slot = 0; slot < slots; slot++) {
        const candidates = staff.filter(s => {
          if (!s.trainedShifts.includes(shift)) return false;
          if (unavailableDates.get(s.id)?.has(d)) return false;
          if (assignedOnDay[d]!.has(s.id)) return false;
          if (chosenForSlot.has(s.id)) return false;

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

        // Pick from those with the fewest total shifts (minimax greedy)
        const minCount = Math.min(...candidates.map(s => totalShifts[s.id]!));
        const tied = candidates.filter(s => totalShifts[s.id] === minCount);
        const chosen = tied[Math.floor(Math.random() * tied.length)]!;

        assignments[chosen.id]![d] = shift;
        assignedOnDay[d]!.add(chosen.id);
        chosenForSlot.add(chosen.id);
        totalShifts[chosen.id]!++;
        weeklyShifts[chosen.id]![weekIdx]!++;
        weeklyTypeShifts[chosen.id]![weekIdx]![shift]++;
      }
    }
  }

  return { month, assignments, status: 'optimal' };
}
