// The Logs Engine query returns every record in the window; this filters by
// user email client-side so one user's investigation never returns another's.
export interface FilterOptions<T> {
  email: string;
  fromTime: string;
  toTime: string;
  emailKey: keyof T;
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

    // Keep records with a missing/unparseable timestamp rather than silently
    // dropping potentially relevant evidence.
    const ts = Date.parse(String(record[timeKey] ?? ''));
    if (Number.isNaN(ts)) return true;
    if (!Number.isNaN(from) && ts < from) return false;
    if (!Number.isNaN(to) && ts > to) return false;
    return true;
  });
}
