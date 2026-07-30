/**
 * Shared record filtering for the log tools.
 *
 * The live Logs Engine query returns every record in the window, so we filter
 * by user email client-side. We apply the same predicate to fixtures so
 * fixture mode behaves like live mode (e.g. investigating a different user
 * does not return another user's canned records).
 */

export interface FilterOptions<T> {
  email: string;
  fromTime: string;
  toTime: string;
  /** Record key holding the user email (e.g. 'Email'). */
  emailKey: keyof T;
  /** Record key holding the ISO 8601 timestamp (e.g. 'CreatedAt', 'Datetime'). */
  timeKey: keyof T;
}

export function filterRecords<T>(
  records: T[],
  { email, fromTime, toTime, emailKey, timeKey }: FilterOptions<T>,
): T[] {
  const from = Date.parse(fromTime);
  const to = Date.parse(toTime);
  const target = email.toLowerCase();

  return records.filter((record) => {
    const recordEmail = String(record[emailKey] ?? '').toLowerCase();
    if (recordEmail !== target) return false;

    // If the timestamp is missing or unparseable, keep the record rather than
    // silently dropping potentially relevant evidence.
    const ts = Date.parse(String(record[timeKey] ?? ''));
    if (Number.isNaN(ts)) return true;
    if (!Number.isNaN(from) && ts < from) return false;
    if (!Number.isNaN(to) && ts > to) return false;
    return true;
  });
}
