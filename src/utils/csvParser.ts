import { toDateString } from './dateUtils';
import type { StaffMember } from '../types';

/** A single calendar event extracted from a shared calendar CSV. */
export interface ParsedEvent {
  subject: string;
  dates: string[]; // YYYY-MM-DD dates covered by this event
}

/**
 * Parses a shared Outlook calendar CSV and returns one ParsedEvent per row.
 * Expected columns (case-insensitive): Subject, Start Date, End Date
 */
export function parseSharedCalendarCsv(csvContent: string): ParsedEvent[] {
  // Strip UTF-8 BOM if present (common in Windows Outlook CSV exports)
  const content = csvContent.replace(/^\uFEFF/, '');
  const lines = splitLines(content);
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0] ?? '').map(h => h.trim().toLowerCase());
  const subjectIdx = findHeader(headers, ['subject']);
  const startDateIdx = findHeader(headers, ['start date', 'startdate', 'start']);
  const endDateIdx = findHeader(headers, ['end date', 'enddate', 'end']);

  if (subjectIdx === -1 || startDateIdx === -1) return [];

  const events: ParsedEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i] ?? '');
    if (row.length === 0) continue;

    const subject = row[subjectIdx]?.trim() ?? '';
    const startRaw = row[startDateIdx]?.trim() ?? '';
    const endRaw = endDateIdx !== -1 ? (row[endDateIdx]?.trim() ?? '') : '';

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

    if (dates.length > 0) {
      events.push({ subject, dates });
    }
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
 *
 * NOTE per AGENTS.md: matching is by filename, so the caller handles which
 * staff member this CSV belongs to. This function just extracts unavailable dates.
 */
export function parseOutlookCsv(csvContent: string): string[] {
  const lines = splitLines(csvContent);
  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0] ?? '').map(h => h.trim().toLowerCase());
  const startDateIdx = findHeader(headers, ['start date', 'startdate', 'start']);
  const endDateIdx = findHeader(headers, ['end date', 'enddate', 'end']);

  if (startDateIdx === -1) return [];

  const unavailable = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i] ?? '');
    if (row.length === 0) continue;

    const startRaw = row[startDateIdx]?.trim() ?? '';
    const endRaw = endDateIdx !== -1 ? (row[endDateIdx]?.trim() ?? '') : '';

    const startDate = parseOutlookDate(startRaw);
    if (!startDate) continue;

    const endDate = endRaw ? (parseOutlookDate(endRaw) ?? startDate) : startDate;

    // Mark all calendar dates in [startDate, endDate] as unavailable
    const cur = new Date(startDate.getTime());
    const limit = new Date(endDate.getTime());
    // Guard against absurdly long ranges
    let safety = 0;
    while (cur <= limit && safety < 400) {
      unavailable.add(toDateString(cur));
      cur.setDate(cur.getDate() + 1);
      safety++;
    }
  }

  return Array.from(unavailable).sort();
}

/** Parses Outlook date format: M/D/YYYY or YYYY-MM-DD */
function parseOutlookDate(raw: string): Date | null {
  if (!raw) return null;

  // Try M/D/YYYY
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash.map(Number);
    const date = new Date(y!, m! - 1, d!);
    return isNaN(date.getTime()) ? null : date;
  }

  // Try YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso.map(Number);
    const date = new Date(y!, m! - 1, d!);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Splits CSV content into non-empty lines, handling Windows line endings. */
function splitLines(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);
}

/** Returns index of first matching header name, or -1. */
function findHeader(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Parses a single CSV row, handling quoted fields. */
function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}
