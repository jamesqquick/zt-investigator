import { describe, expect, test } from 'vitest';
import { redact } from '../src/observability.ts';

describe('redact', () => {
  test('masks email local part, keeps domain', () => {
    expect(redact('user alice@corp.com logged in')).toContain('a***@corp.com');
    expect(redact('alice@corp.com')).not.toContain('alice@corp.com');
  });

  test('masks IPv4 host bits, keeps network hint', () => {
    expect(redact('src 203.0.113.42 seen')).toContain('203.0.x.x');
    expect(redact('203.0.113.42')).not.toContain('113.42');
  });

  test('does not mangle short dotted version numbers', () => {
    // os_version "14.5.1" has only three parts and must not be treated as IPv4.
    expect(redact('macOS 14.5.1')).toContain('14.5.1');
  });

  test('masks IPv6 addresses', () => {
    expect(redact('peer 2001:db8::1 connected')).toContain('[ipv6]');
    expect(redact('2001:db8::1')).not.toContain('2001:db8');
  });

  test('keeps only the first 8 chars of a device UUID', () => {
    const out = redact('device 7f3a1c22-9b4e-4d1a-8c2f-1e6b0a9d5c30 posture');
    expect(out).toContain('7f3a1c22…');
    expect(out).not.toContain('9b4e-4d1a');
  });
});
