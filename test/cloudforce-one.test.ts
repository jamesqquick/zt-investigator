import type Cloudflare from 'cloudflare';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  getCloudforceOneEvents,
  type CloudforceOneEntry,
} from '../src/tools/cloudforce-one.ts';
import { cloudforceOneEnabled } from '../src/lib/config.ts';
import { __setCloudflareClientForTests } from '../src/lib/cf-client.ts';

type CloudforceOneResult =
  | { available: false; reason: string }
  | { available: true; results: Record<string, CloudforceOneEntry> };

const runCF1 = async (indicators: string[]) =>
  (
    (await getCloudforceOneEvents.run({ data: { indicators } } as never)) as {
      output: CloudforceOneResult;
    }
  ).output;

// RAW threat_events list response — a bare array, as the SDK returns. Only the
// C2 domain has an attributed event; other indicators → no_match.
const eventsResponse = [
  {
    uuid: '7f3a1c22-9b4e-4d1a-8c2f-1e6b0a9d5c30',
    indicator: 'malware-c2-domain.ru',
    indicatorType: 'domain',
    category: 'Command and Control',
    event: 'Domain observed as active C2 for the SALT TYPHOON intrusion set',
    attacker: 'Salt Typhoon',
    attackerCountry: 'CN',
    killChain: 6,
    mitreAttack: ['T1071.001', 'T1041'],
    tags: ['apt', 'c2', 'data-exfiltration'],
    tlp: 'amber',
    insight: 'Infrastructure attributed to Salt Typhoon.',
    date: '2026-07-20T00:00:00Z',
  },
];

const fakeClient = {
  cloudforceOne: {
    threatEvents: {
      list: async () => eventsResponse,
    },
  },
} as unknown as Cloudflare;

const TOKEN_VARS = ['CLOUDFORCE_ONE_API_TOKEN', 'CF_ACCOUNT_ID'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of TOKEN_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});
afterEach(() => {
  __setCloudflareClientForTests(undefined);
  for (const key of TOKEN_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('gating', () => {
  test('disabled when the token is absent', () => {
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

describe('get_cloudforce_one_events (injected client)', () => {
  beforeEach(() => {
    process.env.CLOUDFORCE_ONE_API_TOKEN = 'cf1-token';
    process.env.CF_ACCOUNT_ID = 'acct123';
    __setCloudflareClientForTests(fakeClient);
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
