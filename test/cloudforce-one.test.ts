import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  getCloudforceOneEvents,
  type CloudforceOneEntry,
} from '../src/tools/cloudforce-one.ts';
import { cloudforceOneEnabled } from '../src/lib/config.ts';

type CloudforceOneResult =
  | { available: false; reason: string }
  | { available: true; results: Record<string, CloudforceOneEntry> };

const runCF1 = (indicators: string[]) =>
  getCloudforceOneEvents.run({ data: { indicators } } as never) as Promise<CloudforceOneResult>;

const TOKEN_VARS = ['USE_FIXTURES', 'CLOUDFORCE_ONE_API_TOKEN', 'CF_ACCOUNT_ID'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of TOKEN_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  for (const key of TOKEN_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('gating', () => {
  test('disabled when neither fixtures nor token', () => {
    expect(cloudforceOneEnabled()).toBe(false);
  });
});

describe('get_cloudforce_one_events (live, unconfigured)', () => {
  test('returns available:false when the token is not set', async () => {
    const result = await runCF1(['malware-c2-domain.ru']);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toMatch(/CLOUDFORCE_ONE_API_TOKEN/);
  });
});

describe('get_cloudforce_one_events (fixture mode)', () => {
  beforeEach(() => {
    process.env.USE_FIXTURES = 'true';
  });

  test('matches an attributed event and preserves attribution', async () => {
    const result = await runCF1(['malware-c2-domain.ru']);
    expect(result.available).toBe(true);
    if (!result.available) return;
    const entry = result.results['malware-c2-domain.ru'];
    expect(entry.status).toBe('matched');
    expect(entry.events[0].attacker).toBe('Salt Typhoon');
    expect(entry.events[0].mitreAttack).toContain('T1071.001');
  });

  test('known-clean indicator is a real no_match (not a failure)', async () => {
    const result = await runCF1(['185.220.101.45']);
    if (!result.available) throw new Error('expected available');
    expect(result.results['185.220.101.45'].status).toBe('no_match');
  });

  test('indicator absent from the fixture defaults to no_match', async () => {
    const result = await runCF1(['8.8.8.8']);
    if (!result.available) throw new Error('expected available');
    expect(result.results['8.8.8.8'].status).toBe('no_match');
    expect(result.results['8.8.8.8'].events).toEqual([]);
  });
});
