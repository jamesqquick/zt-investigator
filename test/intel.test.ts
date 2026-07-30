import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { classify, getIndicatorIntel, type IntelEntry } from '../src/tools/intel.ts';

describe('classify', () => {
  test('IPv4', () => {
    expect(classify('8.8.8.8')).toBe('ipv4');
    expect(classify('185.220.101.45')).toBe('ipv4');
  });
  test('rejects octets > 255 as non-IPv4', () => {
    expect(classify('999.1.1.1')).not.toBe('ipv4');
  });
  test('IPv6', () => {
    expect(classify('2001:db8::1')).toBe('ipv6');
  });
  test('domain', () => {
    expect(classify('malware-c2-domain.ru')).toBe('domain');
    expect(classify('example.com')).toBe('domain');
  });
  test('unknown for junk input', () => {
    expect(classify('not a valid indicator')).toBe('unknown');
  });
});

// The tool's run returns a JsonValue; cast back to the known shape for assertions.
type IntelResult = Record<string, IntelEntry>;
const runIntel = (indicators: string[]) =>
  getIndicatorIntel.run({ data: { indicators } } as never) as Promise<IntelResult>;

describe('get_indicator_intel (fixture mode)', () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.USE_FIXTURES;
    process.env.USE_FIXTURES = 'true';
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.USE_FIXTURES;
    else process.env.USE_FIXTURES = saved;
  });

  test('returns enriched threat entries for known indicators', async () => {
    const result = await runIntel(['185.220.101.45', 'malware-c2-domain.ru']);
    expect(result['185.220.101.45'].status).toBe('enriched');
    expect(result['185.220.101.45'].is_threat).toBe(true);
    expect(result['malware-c2-domain.ru'].is_threat).toBe(true);
  });

  test('unknown indicators are lookup_failed, never silently clean', async () => {
    const result = await runIntel(['8.8.8.8']); // valid IP, but no fixture entry
    expect(result['8.8.8.8'].status).toBe('lookup_failed');
    expect(result['8.8.8.8'].is_threat).toBe(false);
    expect(result['8.8.8.8'].error).toBeTruthy();
  });
});
