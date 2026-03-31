import { toDateString } from './dateUtils';

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
