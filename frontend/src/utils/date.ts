/** Local-calendar helpers for YYYY-MM-DD date strings.
 *
 * All semantics are the user's local calendar day. Never derive a date
 * string via `toISOString()` — it answers in UTC, which disagrees with
 * the local day for part of every evening (and all day at UTC+13/+14).
 */

/** Parse a YYYY-MM-DD string to a Date at local midnight. */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD using its local calendar day. */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's local calendar day as YYYY-MM-DD. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** Whether a YYYY-MM-DD string is the local calendar day. */
export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

/** Shift a YYYY-MM-DD string by whole days (local calendar arithmetic). */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

/** Locale-format a YYYY-MM-DD string without timezone shifts. */
export function formatDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return parseDateStr(dateStr).toLocaleDateString(undefined, options);
}
