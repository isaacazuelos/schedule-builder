export type Role = 'OP2' | 'SA1' | 'SA2';
export type Team = 'domestic' | 'international';
export type ShiftType = 'phones-am' | 'phones-pm' | 'inperson-am' | 'inperson-pm' | 'qp-am' | 'qp-pm';
export type TabName = 'staff' | 'availability' | 'constraints' | 'output';

export const DAILY_SHIFTS: ShiftType[]  = ['phones-am', 'phones-pm', 'inperson-am', 'inperson-pm'];
export const WEEKLY_SHIFTS: ShiftType[] = ['qp-am', 'qp-pm'];
export const ALL_SHIFTS: ShiftType[]    = [...DAILY_SHIFTS, ...WEEKLY_SHIFTS];
export const ALL_ROLES: Role[]          = ['OP2', 'SA1', 'SA2'];
export const ALL_TEAMS: Team[]          = ['domestic', 'international'];

/** Display order for role and team — used as sort keys across tabs. */
export const ROLE_ORDER: Record<Role, number> = { OP2: 0, SA1: 1, SA2: 2 };

export const TEAM_LABELS: Record<Team, string> = {
  domestic: 'Domestic',
  international: 'International',
};

/** Header label for the International Team column in the staff CSV. */
export const INTL_CSV_COLUMN = 'International Team';

export function teamOf(s: { isInternational: boolean }): Team {
  return s.isInternational ? 'international' : 'domestic';
}

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
  isInternational: boolean;
}

/** A manual override of a person's availability for a specific date and half-day period. */
export interface DateOverride {
  staffId: string;
  date: string;       // YYYY-MM-DD
  period: 'am' | 'pm';
  available: boolean;
}

/** A role+team-wide override — marks everyone with the given role on the given team as unavailable for a date/period. */
export interface RoleOverride {
  role: Role;
  team: Team;
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
  team: Team;
  maxShiftsPerWeek: number;
  maxPerType: Partial<Record<ShiftType, number>>;
}

const DEFAULT_MAX_PER_TYPE_BY_ROLE: Record<Role, Partial<Record<ShiftType, number>>> = {
  OP2: { 'qp-am': 0, 'qp-pm': 0 },
  SA1: {},
  SA2: {},
};

export const DEFAULT_WEEKLY_CAPS: WeeklyCap[] = ALL_ROLES.flatMap(role =>
  ALL_TEAMS.map(team => ({
    role,
    team,
    maxShiftsPerWeek: 5,
    maxPerType: { ...DEFAULT_MAX_PER_TYPE_BY_ROLE[role] },
  }))
);

/** Points awarded per assignment for fairness balancing. For QP shifts the weight is applied per workday in the week. */
export type ShiftWeights = Record<ShiftType, number>;

export const DEFAULT_SHIFT_WEIGHTS: ShiftWeights = {
  'phones-am':   1,
  'phones-pm':   1,
  'inperson-am': 1,
  'inperson-pm': 1,
  'qp-am':       1,
  'qp-pm':       1,
};

/** Which shift windows a calendar event blocks. */
export type DayBlock = 'am' | 'pm' | 'both';

/** staffId -> date -> which shift windows are blocked (from CSV import) */
export type CsvUnavailability = Record<string, Record<string, DayBlock>>;

/** A single event parsed from a shared calendar CSV, pending staff assignment. */
export interface PendingImportEvent {
  id: string;                    // uuid, stable React key
  subject: string;               // raw event title from CSV
  dates: string[];               // YYYY-MM-DD dates covered by this event
  blocked: DayBlock;             // which shift windows this event blocks
  assignedStaffId: string | null; // null = unassigned
  dismissed: boolean;
}

export interface PendingImport {
  events: PendingImportEvent[];
}

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
  roleOverrides: RoleOverride[];
  holidays: string[]; // YYYY-MM-DD
  slotCounts: SlotCounts;
  weeklyCaps: WeeklyCap[];
  shiftWeights: ShiftWeights;
  targetMonth: string; // YYYY-MM
  schedule: Schedule | null;
  solveStatus: 'idle' | 'solving';
  pendingImport: PendingImport | null;
}

/** The JSON shape exported/imported for config persistence. */
export interface ExportedConfig {
  staff: StaffMember[];
  overrides: DateOverride[];
  roleOverrides?: RoleOverride[];
  holidays: string[];
  slotCounts: SlotCounts;
  weeklyCaps: WeeklyCap[];
  shiftWeights?: ShiftWeights;
  targetMonth: string;
}
