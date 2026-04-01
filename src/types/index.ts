export type Role = 'OP2' | 'SA1' | 'SA2';
export type ShiftType = 'phones-am' | 'phones-pm' | 'inperson-am' | 'inperson-pm' | 'qp-am' | 'qp-pm';
export type TabName = 'staff' | 'availability' | 'constraints' | 'output';

export const DAILY_SHIFTS: ShiftType[]  = ['phones-am', 'phones-pm', 'inperson-am', 'inperson-pm'];
export const WEEKLY_SHIFTS: ShiftType[] = ['qp-am', 'qp-pm'];
export const ALL_SHIFTS: ShiftType[]    = [...DAILY_SHIFTS, ...WEEKLY_SHIFTS];
export const ALL_ROLES: Role[]          = ['OP2', 'SA1', 'SA2'];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  'phones-am':   'Phones AM',
  'phones-pm':   'Phones PM',
  'inperson-am': 'In-Person AM',
  'inperson-pm': 'In-Person PM',
  'qp-am':       'QP AM',
  'qp-pm':       'QP PM',
};

// Default trained shifts per role per AGENTS.md:
// OP2 can only do phones; SA1 and SA2 can do any type including QP.
export const DEFAULT_TRAINED_BY_ROLE: Record<Role, ShiftType[]> = {
  OP2: ['phones-am', 'phones-pm'],
  SA1: ['phones-am', 'phones-pm', 'inperson-am', 'inperson-pm', 'qp-am', 'qp-pm'],
  SA2: ['phones-am', 'phones-pm', 'inperson-am', 'inperson-pm', 'qp-am', 'qp-pm'],
};

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  trainedShifts: ShiftType[];
}

/** A manual override of a person's availability for a specific date and half-day period. */
export interface DateOverride {
  staffId: string;
  date: string;       // YYYY-MM-DD
  period: 'am' | 'pm';
  available: boolean;
}

export interface SlotCounts {
  'phones-am':   number;
  'phones-pm':   number;
  'inperson-am': number;
  'inperson-pm': number;
  /** Number of QP people assigned per week (typically 1). */
  'qp-am':       number;
  'qp-pm':       number;
}

export const DEFAULT_SLOT_COUNTS: SlotCounts = {
  'phones-am':   2,
  'phones-pm':   2,
  'inperson-am': 1,
  'inperson-pm': 1,
  'qp-am':       1,
  'qp-pm':       1,
};

export interface WeeklyCap {
  role: Role;
  maxShiftsPerWeek: number;
  maxPerType: Partial<Record<ShiftType, number>>;
}

export const DEFAULT_WEEKLY_CAPS: WeeklyCap[] = [
  { role: 'OP2', maxShiftsPerWeek: 5, maxPerType: { 'qp-am': 0, 'qp-pm': 0 } },
  { role: 'SA1', maxShiftsPerWeek: 5, maxPerType: {} },
  { role: 'SA2', maxShiftsPerWeek: 5, maxPerType: {} },
];

/** staffId -> set of dates where person is unavailable (from Outlook CSV import, applies to both AM and PM) */
export type CsvUnavailability = Record<string, string[]>;

/** Resulting schedule: staffId -> date -> shift assigned */
export type AssignmentMap = Record<string, Record<string, ShiftType>>;

export type SolveStatus = 'optimal' | 'infeasible' | 'timeout' | 'error';

export interface Schedule {
  month: string; // YYYY-MM
  assignments: AssignmentMap;
  status: SolveStatus;
  message?: string;
}

export interface AppState {
  activeTab: TabName;
  staff: StaffMember[];
  csvUnavailability: CsvUnavailability;
  overrides: DateOverride[];
  holidays: string[]; // YYYY-MM-DD
  slotCounts: SlotCounts;
  weeklyCaps: WeeklyCap[];
  targetMonth: string; // YYYY-MM
  schedule: Schedule | null;
  solveStatus: 'idle' | 'solving';
}

/** The JSON shape exported/imported for config persistence. */
export interface ExportedConfig {
  staff: StaffMember[];
  overrides: DateOverride[];
  holidays: string[];
  slotCounts: SlotCounts;
  weeklyCaps: WeeklyCap[];
  targetMonth: string;
}
