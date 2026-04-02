import { useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppState,
  StaffMember,
  Role,
  ShiftType,
  DayBlock,
  DateOverride,
  Schedule,
  TabName,
  ExportedConfig,
  PendingImportEvent,
} from '../types';
import {
  DEFAULT_SLOT_COUNTS,
  DEFAULT_WEEKLY_CAPS,
  DEFAULT_TRAINED_BY_ROLE,
} from '../types';

// ─── Action types ────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_TAB'; tab: TabName }
  | { type: 'ADD_STAFF'; name: string; role: Role }
  | { type: 'REMOVE_STAFF'; id: string }
  | { type: 'UPDATE_STAFF_NAME'; id: string; name: string }
  | { type: 'UPDATE_STAFF_ROLE'; id: string; role: Role }
  | { type: 'TOGGLE_TRAINED_SHIFT'; id: string; shift: ShiftType }
  | { type: 'TOGGLE_OVERRIDE'; staffId: string; date: string; period: 'am' | 'pm'; available: boolean }
  | { type: 'REMOVE_OVERRIDE'; staffId: string; date: string; period: 'am' | 'pm' }
  | { type: 'TOGGLE_HOLIDAY'; date: string }
  | { type: 'SET_SLOT_COUNT'; shift: ShiftType; count: number }
  | { type: 'SET_WEEKLY_CAP'; role: Role; maxShiftsPerWeek: number }
  | { type: 'SET_WEEKLY_TYPE_CAP'; role: Role; shift: ShiftType; max: number | null }
  | { type: 'SET_TARGET_MONTH'; month: string }
  | { type: 'SET_SOLVE_STATUS'; status: 'idle' | 'solving' }
  | { type: 'SET_SCHEDULE'; schedule: Schedule }
  | { type: 'LOAD_CONFIG'; config: ExportedConfig }
  | { type: 'CLEAR_ALL_STAFF' }
  | { type: 'CLEAR_AVAILABILITY' }
  | { type: 'SET_PENDING_IMPORT'; events: PendingImportEvent[] }
  | { type: 'UPDATE_PENDING_ASSIGNMENT'; eventId: string; staffId: string | null; dismissed: boolean }
  | { type: 'CONFIRM_PENDING_IMPORT' }
  | { type: 'CANCEL_PENDING_IMPORT' };

// ─── Initial state ────────────────────────────────────────────────────────────

function nextYearMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EXAMPLE_STAFF: StaffMember[] = (
  [
    ['Michael Scott',    'SA1'],
    ['Dwight Schrute',   'SA2'],
    ['Jim Halpert',      'SA1'],
    ['Pam Beesly',       'SA2'],
    ['Ryan Howard',      'OP2'],
    ['Andy Bernard',     'SA1'],
    ['Angela Martin',    'OP2'],
    ['Kevin Malone',     'OP2'],
    ['Oscar Martinez',   'SA2'],
    ['Kelly Kapoor',     'OP2'],
    ['Toby Flenderson',  'SA1'],
    ['Meredith Palmer',  'OP2'],
    ['Creed Bratton',    'OP2'],
    ['Stanley Hudson',   'SA2'],
    ['Phyllis Vance',    'SA1'],
    ['Darryl Philbin',   'SA2'],
    ['Erin Hannon',      'SA1'],
    ['Jan Levinson',     'SA2'],
    ['Karen Filippelli', 'OP2'],
    ['Roy Anderson',     'OP2'],
  ] as [string, Role][]
).map(([name, role], i) => ({
  id: `example-${i}`,
  name,
  role,
  trainedShifts: [...DEFAULT_TRAINED_BY_ROLE[role]],
}));

const initialState: AppState = {
  activeTab: 'output',
  staff: EXAMPLE_STAFF,
  csvUnavailability: {},
  overrides: [],
  holidays: [],
  slotCounts: { ...DEFAULT_SLOT_COUNTS },
  weeklyCaps: DEFAULT_WEEKLY_CAPS.map(c => ({ ...c, maxPerType: { ...c.maxPerType } })),
  targetMonth: nextYearMonth(),
  schedule: null,
  solveStatus: 'idle',
  pendingImport: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeBlock(existing: DayBlock | undefined, incoming: DayBlock): DayBlock {
  if (!existing) return incoming;
  if (existing === 'both' || incoming === 'both') return 'both';
  if (existing === incoming) return existing;
  return 'both'; // 'am' + 'pm' → 'both'
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.tab };

    case 'ADD_STAFF': {
      const member: StaffMember = {
        id: uuidv4(),
        name: action.name,
        role: action.role,
        trainedShifts: [...DEFAULT_TRAINED_BY_ROLE[action.role]],
      };
      return { ...state, staff: [...state.staff, member] };
    }

    case 'REMOVE_STAFF':
      return {
        ...state,
        staff: state.staff.filter(s => s.id !== action.id),
        overrides: state.overrides.filter(o => o.staffId !== action.id),
        csvUnavailability: Object.fromEntries(
          Object.entries(state.csvUnavailability).filter(([id]) => id !== action.id)
        ),
      };

    case 'UPDATE_STAFF_NAME':
      return {
        ...state,
        staff: state.staff.map(s => s.id === action.id ? { ...s, name: action.name } : s),
      };

    case 'UPDATE_STAFF_ROLE': {
      return {
        ...state,
        staff: state.staff.map(s =>
          s.id === action.id
            ? { ...s, role: action.role, trainedShifts: [...DEFAULT_TRAINED_BY_ROLE[action.role]] }
            : s
        ),
      };
    }

    case 'TOGGLE_TRAINED_SHIFT':
      return {
        ...state,
        staff: state.staff.map(s => {
          if (s.id !== action.id) return s;
          const has = s.trainedShifts.includes(action.shift);
          return {
            ...s,
            trainedShifts: has
              ? s.trainedShifts.filter(sh => sh !== action.shift)
              : [...s.trainedShifts, action.shift],
          };
        }),
      };

    case 'TOGGLE_OVERRIDE': {
      const match = (o: DateOverride) =>
        o.staffId === action.staffId && o.date === action.date && o.period === action.period;
      const existing = state.overrides.find(match);
      let overrides: DateOverride[];
      if (existing && existing.available === action.available) {
        // Same state — remove override (toggle off)
        overrides = state.overrides.filter(o => !match(o));
      } else {
        overrides = [
          ...state.overrides.filter(o => !match(o)),
          { staffId: action.staffId, date: action.date, period: action.period, available: action.available },
        ];
      }
      return { ...state, overrides };
    }

    case 'REMOVE_OVERRIDE':
      return {
        ...state,
        overrides: state.overrides.filter(
          o => !(o.staffId === action.staffId && o.date === action.date && o.period === action.period)
        ),
      };

    case 'TOGGLE_HOLIDAY': {
      const has = state.holidays.includes(action.date);
      return {
        ...state,
        holidays: has
          ? state.holidays.filter(d => d !== action.date)
          : [...state.holidays, action.date],
      };
    }

    case 'SET_SLOT_COUNT':
      return {
        ...state,
        slotCounts: { ...state.slotCounts, [action.shift]: action.count },
      };

    case 'SET_WEEKLY_CAP':
      return {
        ...state,
        weeklyCaps: state.weeklyCaps.map(c =>
          c.role === action.role ? { ...c, maxShiftsPerWeek: action.maxShiftsPerWeek } : c
        ),
      };

    case 'SET_WEEKLY_TYPE_CAP':
      return {
        ...state,
        weeklyCaps: state.weeklyCaps.map(c => {
          if (c.role !== action.role) return c;
          const maxPerType = { ...c.maxPerType };
          if (action.max === null) {
            delete maxPerType[action.shift];
          } else {
            maxPerType[action.shift] = action.max;
          }
          return { ...c, maxPerType };
        }),
      };

    case 'SET_TARGET_MONTH':
      return { ...state, targetMonth: action.month, schedule: null };

    case 'SET_SOLVE_STATUS':
      return { ...state, solveStatus: action.status };

    case 'SET_SCHEDULE':
      return { ...state, schedule: action.schedule, solveStatus: 'idle' };

    case 'LOAD_CONFIG':
      return {
        ...state,
        staff: action.config.staff,
        overrides: action.config.overrides,
        holidays: action.config.holidays,
        // Merge with defaults so old exported configs missing qp-am/qp-pm still work
        slotCounts: { ...DEFAULT_SLOT_COUNTS, ...action.config.slotCounts },
        weeklyCaps: action.config.weeklyCaps,
        targetMonth: action.config.targetMonth,
        schedule: null,
      };

    case 'CLEAR_ALL_STAFF':
      return { ...state, staff: [], csvUnavailability: {}, overrides: [] };

    case 'CLEAR_AVAILABILITY':
      return { ...state, csvUnavailability: {}, overrides: [] };

    case 'SET_PENDING_IMPORT':
      return { ...state, pendingImport: { events: action.events } };

    case 'UPDATE_PENDING_ASSIGNMENT': {
      if (!state.pendingImport) return state;
      return {
        ...state,
        pendingImport: {
          events: state.pendingImport.events.map(e =>
            e.id === action.eventId
              ? { ...e, assignedStaffId: action.staffId, dismissed: action.dismissed }
              : e
          ),
        },
      };
    }

    case 'CONFIRM_PENDING_IMPORT': {
      if (!state.pendingImport) return state;
      const updated = { ...state.csvUnavailability };
      for (const event of state.pendingImport.events) {
        if (event.dismissed || !event.assignedStaffId) continue;
        const dateMap = { ...(updated[event.assignedStaffId] ?? {}) };
        for (const date of event.dates) {
          dateMap[date] = mergeBlock(dateMap[date], event.blocked);
        }
        updated[event.assignedStaffId] = dateMap;
      }
      return { ...state, csvUnavailability: updated, pendingImport: null };
    }

    case 'CANCEL_PENDING_IMPORT':
      return { ...state, pendingImport: null };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setTab = useCallback((tab: TabName) => dispatch({ type: 'SET_TAB', tab }), []);
  const addStaff = useCallback((name: string, role: Role) => dispatch({ type: 'ADD_STAFF', name, role }), []);
  const removeStaff = useCallback((id: string) => dispatch({ type: 'REMOVE_STAFF', id }), []);
  const updateStaffName = useCallback((id: string, name: string) => dispatch({ type: 'UPDATE_STAFF_NAME', id, name }), []);
  const updateStaffRole = useCallback((id: string, role: Role) => dispatch({ type: 'UPDATE_STAFF_ROLE', id, role }), []);
  const toggleTrainedShift = useCallback((id: string, shift: ShiftType) => dispatch({ type: 'TOGGLE_TRAINED_SHIFT', id, shift }), []);
  const toggleOverride = useCallback((staffId: string, date: string, period: 'am' | 'pm', available: boolean) => dispatch({ type: 'TOGGLE_OVERRIDE', staffId, date, period, available }), []);
  const removeOverride = useCallback((staffId: string, date: string, period: 'am' | 'pm') => dispatch({ type: 'REMOVE_OVERRIDE', staffId, date, period }), []);
  const toggleHoliday = useCallback((date: string) => dispatch({ type: 'TOGGLE_HOLIDAY', date }), []);
  const setSlotCount = useCallback((shift: ShiftType, count: number) => dispatch({ type: 'SET_SLOT_COUNT', shift, count }), []);
  const setWeeklyCap = useCallback((role: Role, max: number) => dispatch({ type: 'SET_WEEKLY_CAP', role, maxShiftsPerWeek: max }), []);
  const setWeeklyTypeCap = useCallback((role: Role, shift: ShiftType, max: number | null) => dispatch({ type: 'SET_WEEKLY_TYPE_CAP', role, shift, max }), []);
  const setTargetMonth = useCallback((month: string) => dispatch({ type: 'SET_TARGET_MONTH', month }), []);
  const setSolveStatus = useCallback((status: 'idle' | 'solving') => dispatch({ type: 'SET_SOLVE_STATUS', status }), []);
  const setSchedule = useCallback((schedule: Schedule) => dispatch({ type: 'SET_SCHEDULE', schedule }), []);
  const loadConfig = useCallback((config: ExportedConfig) => dispatch({ type: 'LOAD_CONFIG', config }), []);
  const clearAllStaff = useCallback(() => dispatch({ type: 'CLEAR_ALL_STAFF' }), []);
  const clearAvailability = useCallback(() => dispatch({ type: 'CLEAR_AVAILABILITY' }), []);
  const setPendingImport = useCallback((events: PendingImportEvent[]) => dispatch({ type: 'SET_PENDING_IMPORT', events }), []);
  const updatePendingAssignment = useCallback((eventId: string, staffId: string | null, dismissed: boolean) => dispatch({ type: 'UPDATE_PENDING_ASSIGNMENT', eventId, staffId, dismissed }), []);
  const confirmPendingImport = useCallback(() => dispatch({ type: 'CONFIRM_PENDING_IMPORT' }), []);
  const cancelPendingImport = useCallback(() => dispatch({ type: 'CANCEL_PENDING_IMPORT' }), []);

  /** Compute effective availability for a specific date and half-day period. */
  const isAvailable = useCallback(
    (staffId: string, date: string, period: 'am' | 'pm'): boolean => {
      const override = state.overrides.find(
        o => o.staffId === staffId && o.date === date && o.period === period
      );
      if (override !== undefined) return override.available;
      const block = state.csvUnavailability[staffId]?.[date];
      if (!block) return true;
      if (block === 'both') return false;
      return block !== period;
    },
    [state.overrides, state.csvUnavailability]
  );

  return {
    state,
    setTab,
    addStaff,
    removeStaff,
    updateStaffName,
    updateStaffRole,
    toggleTrainedShift,
    toggleOverride,
    removeOverride,
    toggleHoliday,
    setSlotCount,
    setWeeklyCap,
    setWeeklyTypeCap,
    setTargetMonth,
    setSolveStatus,
    setSchedule,
    loadConfig,
    clearAllStaff,
    clearAvailability,
    setPendingImport,
    updatePendingAssignment,
    confirmPendingImport,
    cancelPendingImport,
    isAvailable,
  };
}

export type AppStore = ReturnType<typeof useAppState>;
