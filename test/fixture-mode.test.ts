import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { IntelEntry } from '../src/tools/intel.ts';
import type { CloudforceOneResult } from '../src/tools/cloudforce-one.ts';

// FIXTURE_MODE wires offline fakes at module load, so tools must be imported
// AFTER the flag is set — hence the dynamic import inside beforeAll.

type Tool = { run: (arg: { data: unknown }) => Promise<unknown> };

let getIndicatorIntel: Tool;
let getCloudforceOneEvents: Tool;
let getDevicePosture: Tool;
let getAccessLogs: Tool;
let savedFixtureMode: string | undefined;

beforeAll(async () => {
  savedFixtureMode = process.env.FIXTURE_MODE;
  process.env.FIXTURE_MODE = 'true';
  ({ getIndicatorIntel } = (await import('../src/tools/intel.ts')) as unknown as {
    getIndicatorIntel: Tool;
  });
  ({ getCloudforceOneEvents } = (await import('../src/tools/cloudforce-one.ts')) as unknown as {
    getCloudforceOneEvents: Tool;
  });
  ({ getDevicePosture } = (await import('../src/tools/device-posture.ts')) as unknown as {
    getDevicePosture: Tool;
  });
  ({ getAccessLogs } = (await import('../src/tools/access-logs.ts')) as unknown as {
    getAccessLogs: Tool;
  });
});

afterAll(() => {
  if (savedFixtureMode === undefined) delete process.env.FIXTURE_MODE;
  else process.env.FIXTURE_MODE = savedFixtureMode;
});

describe('FIXTURE_MODE (offline runtime)', () => {
  test('intel enriches canned indicators through the real SDK mapping', async () => {
    const out = (await getIndicatorIntel.run({
      data: { indicators: ['185.220.101.45', 'malware-c2-domain.ru', 'pastebin.com'] },
    })) as Record<string, IntelEntry>;

    expect(out['185.220.101.45'].status).toBe('enriched');
    expect(out['185.220.101.45'].is_threat).toBe(true);
    expect(out['185.220.101.45'].asn?.number).toBe(24940);
    expect(out['malware-c2-domain.ru'].is_threat).toBe(true);
    expect(out['pastebin.com'].is_threat).toBe(false);
  });

  test('cloudforce one is enabled and matches the attributed C2 event', async () => {
    const out = (await getCloudforceOneEvents.run({
      data: { indicators: ['malware-c2-domain.ru', '185.220.101.45'] },
    })) as CloudforceOneResult;

    expect(out.available).toBe(true);
    if (!out.available) throw new Error('expected available');
    expect(out.results['malware-c2-domain.ru'].status).toBe('matched');
    expect(out.results['malware-c2-domain.ru'].events[0].attacker).toBe('Salt Typhoon');
    expect(out.results['185.220.101.45'].status).toBe('no_match');
  });

  test('device posture returns the canned WARP device', async () => {
    const out = (await getDevicePosture.run({ data: { deviceId: 'device-abc-123' } })) as {
      success: boolean;
      result: { name: string; os_version?: string };
    };
    expect(out.success).toBe(true);
    expect(out.result.name).toBe('MacBook-Pro-James');
  });

  test('access logs stream canned NDJSON filtered to the user', async () => {
    const out = (await getAccessLogs.run({
      data: {
        userEmail: 'james@company.com',
        fromTime: '2026-07-28T00:00:00Z',
        toTime: '2026-07-30T00:00:00Z',
      },
    })) as { records: Array<{ IPAddress: string }> };
    expect(out.records.length).toBeGreaterThan(0);
    expect(out.records[0].IPAddress).toBe('185.220.101.45');
  });
});
