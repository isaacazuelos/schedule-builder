import Papa from 'papaparse';
import { toDateString } from './dateUtils';
import type { StaffMember, DayBlock } from '../types';

/** A single calendar event extracted from a shared calendar CSV. */
export interface ParsedEvent {
  subject: string;
  dates: string[];   // YYYY-MM-DD dates covered by this event
  blocked: DayBlock; // which shift windows this event blocks
}

// AM shift window: 08:30–13:00; PM shift window: 12:30–16:30
const AM_START = 8.5;
const AM_END   = 13.0;
const PM_START = 12.5;
const PM_END   = 16.5;

/**
 * Parses a shared Outlook calendar CSV and returns one ParsedEvent per row.
 * Expected columns (case-insensitive): Subject, Start Date, End Date,
 * Start Time, End Time, All day event.
 *
 * - All-day or multi-day events block both AM and PM shifts.
 * - Timed single-day events block AM if they overlap 08:30–13:00, and/or
 *   PM if they overlap 12:30–16:30.
 */
export function parseSharedCalendarCsv(csvContent: string): ParsedEvent[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const events: ParsedEvent[] = [];

  for (const row of result.data) {
    const subject    = row['subject']?.trim() ?? '';
    const startRaw   = row['start date']?.trim() ?? '';
    const endRaw     = row['end date']?.trim() ?? '';
    const startTimeR = row['start time']?.trim() ?? '';
    const endTimeR   = row['end time']?.trim() ?? '';
    const allDayRaw  = row['all day event']?.trim().toLowerCase() ?? '';

    const startDate = parseOutlookDate(startRaw);
    if (!startDate) continue;

    const endDate = endRaw ? (parseOutlookDate(endRaw) ?? startDate) : startDate;

    const dates: string[] = [];
    const cur = new Date(startDate.getTime());
    const limit = new Date(endDate.getTime());
    let safety = 0;
    while (cur <= limit && safety < 400) {
      dates.push(toDateString(cur));
      cur.setDate(cur.getDate() + 1);
      safety++;
    }

    if (dates.length === 0) continue;

    // Determine which shift windows are blocked
    const isAllDay   = allDayRaw === 'true' || allDayRaw === 'yes' || allDayRaw === '1';
    const isMultiDay = dates.length > 1;

    let blocked: DayBlock;
    if (isAllDay || isMultiDay) {
      blocked = 'both';
    } else {
      const startH = parseTimeHours(startTimeR);
      const endH   = parseTimeHours(endTimeR);
      if (startH === null || endH === null) {
        blocked = 'both'; // can't determine → conservative
      } else {
        const blocksAm = startH < AM_END   && endH > AM_START;
        const blocksPm = startH < PM_END   && endH > PM_START;
        if (!blocksAm && !blocksPm) continue; // outside both windows
        blocked = blocksAm && blocksPm ? 'both' : blocksAm ? 'am' : 'pm';
      }
    }

    events.push({ subject, dates, blocked });
  }

  return events;
}

/** Returns the length of the longest common substring of a and b (both already lowercased). */
function longestCommonSubstring(a: string, b: string): number {
  let best = 0;
  const dp: number[] = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j]! > best) best = dp[j]!;
      prev = temp;
    }
  }
  return best;
}

/**
 * Returns the staffId of the staff member whose name has the longest common
 * substring with the event subject (case-insensitive). Returns null if the
 * best match is fewer than 3 characters.
 */
export function bestStaffMatch(subject: string, staff: StaffMember[]): string | null {
  const lowerSubject = subject.toLowerCase();
  let bestId: string | null = null;
  let bestScore = 2; // minimum threshold (must beat this to match)
  for (const s of staff) {
    const score = longestCommonSubstring(lowerSubject, s.name.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestId = s.id;
    }
  }
  return bestId;
}

/**
 * Parses a standard Outlook calendar CSV export and returns the set of dates
 * (YYYY-MM-DD) where the person has events (i.e. is unavailable).
 *
 * Expected columns (case-insensitive): Subject, Start Date, End Date
 * Date format: M/D/YYYY (Outlook default)
 */
export function parseOutlookCsv(csvContent: string): string[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const unavailable = new Set<string>();

  for (const row of result.data) {
    const startRaw = row['start date']?.trim() ?? '';
    const endRaw   = row['end date']?.trim() ?? '';

    const startDate = parseOutlookDate(startRaw);
    if (!startDate) continue;

    const endDate = endRaw ? (parseOutlookDate(endRaw) ?? startDate) : startDate;

    const cur = new Date(startDate.getTime());
    const limit = new Date(endDate.getTime());
    let safety = 0;
    while (cur <= limit && safety < 400) {
      unavailable.add(toDateString(cur));
      cur.setDate(cur.getDate() + 1);
      safety++;
    }
  }

  return Array.from(unavailable).sort();
}

/**
 * Parses Outlook date formats: M/D/YYYY or YYYY-MM-DD.
 * Tolerates a trailing time component (e.g. "3/15/2026 9:00:00 AM") by
 * stripping everything after the first space before matching.
 */
function parseOutlookDate(raw: string): Date | null {
  if (!raw) return null;

  // Strip trailing time component if present
  const dateOnly = raw.includes(' ') ? raw.slice(0, raw.indexOf(' ')) : raw;

  // Try M/D/YYYY
  const slash = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash.map(Number);
    const date = new Date(y!, m! - 1, d!);
    return isNaN(date.getTime()) ? null : date;
  }

  // Try YYYY-MM-DD
  const iso = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    const date = new Date(y!, m! - 1, d!);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Parses an Outlook time string into decimal hours.
 * Handles "H:MM AM/PM", "H:MM:SS AM/PM", and 24-hour "H:MM" / "H:MM:SS".
 */
function parseTimeHours(raw: string): number | null {
  if (!raw) return null;

  // 12-hour: H:MM[:SS] AM/PM
  const m12 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1]!);
    const min = parseInt(m12[2]!);
    const ampm = m12[3]!.toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h + min / 60;
  }

  // 24-hour: H:MM[:SS]
  const m24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m24) return parseInt(m24[1]!) + parseInt(m24[2]!) / 60;

  return null;
}
