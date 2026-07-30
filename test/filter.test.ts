import { describe, expect, test } from 'vitest';
import { filterRecords } from '../src/tools/filter.ts';

interface Row {
  Email: string;
  CreatedAt: string;
  note: string;
}

const rows: Row[] = [
  { Email: 'alice@corp.com', CreatedAt: '2026-07-20T10:00:00Z', note: 'in-window' },
  { Email: 'ALICE@corp.com', CreatedAt: '2026-07-20T11:00:00Z', note: 'case-insensitive' },
  { Email: 'alice@corp.com', CreatedAt: '2026-07-19T10:00:00Z', note: 'before-window' },
  { Email: 'alice@corp.com', CreatedAt: '2026-07-21T10:00:00Z', note: 'after-window' },
  { Email: 'bob@corp.com', CreatedAt: '2026-07-20T10:30:00Z', note: 'other-user' },
  { Email: 'alice@corp.com', CreatedAt: 'not-a-date', note: 'unparseable-ts' },
];

const opts = {
  email: 'alice@corp.com',
  fromTime: '2026-07-20T00:00:00Z',
  toTime: '2026-07-20T23:59:59Z',
  emailKey: 'Email' as const,
  timeKey: 'CreatedAt' as const,
};

describe('filterRecords', () => {
  test('keeps only the target user, case-insensitively', () => {
    const notes = filterRecords(rows, opts).map((r) => r.note);
    expect(notes).not.toContain('other-user');
    expect(notes).toContain('case-insensitive');
  });

  test('excludes records outside the time window', () => {
    const notes = filterRecords(rows, opts).map((r) => r.note);
    expect(notes).not.toContain('before-window');
    expect(notes).not.toContain('after-window');
    expect(notes).toContain('in-window');
  });

  test('keeps records with an unparseable timestamp rather than dropping evidence', () => {
    const notes = filterRecords(rows, opts).map((r) => r.note);
    expect(notes).toContain('unparseable-ts');
  });
});
