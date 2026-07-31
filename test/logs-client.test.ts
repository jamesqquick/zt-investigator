import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { gatewayDNSLogsFixture } from '../src/fixtures/index.ts';
import type { GatewayDNSRecord } from '../src/tools/gateway-logs.ts';
import {
  __setLogsFetchForTests,
  CloudflareLogsError,
  InvalidTimeRangeError,
  logsRetrieve,
} from '../src/lib/logs-client.ts';

// The offline seam is an injectable fetch; these tests never touch the network.
const LOGS_VARS = [
  'CF_API_TOKEN',
  'CF_ACCOUNT_ID',
  'CF_R2_ACCESS_KEY_ID',
  'CF_R2_SECRET_ACCESS_KEY',
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of LOGS_VARS) {
    saved[key] = process.env[key];
  }
  process.env.CF_API_TOKEN = 'tok';
  process.env.CF_ACCOUNT_ID = 'acct123';
  process.env.CF_R2_ACCESS_KEY_ID = 'r2-id';
  process.env.CF_R2_SECRET_ACCESS_KEY = 'r2-secret';
});

afterEach(() => {
  __setLogsFetchForTests(undefined);
  for (const key of LOGS_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('logsRetrieve (injected fetch)', () => {
  test('parses NDJSON and normalizes the time window to RFC 3339', async () => {
    const ndjson = gatewayDNSLogsFixture.records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    let capturedUrl = '';
    __setLogsFetchForTests(async (url) => {
      capturedUrl = String(url);
      return new Response(ndjson, { status: 200 });
    });

    const records = await logsRetrieve<GatewayDNSRecord>(
      '2026-07-29T00:00:00.123Z',
      '2026-07-30T00:00:00Z',
      'gateway_dns',
    );

    expect(records).toHaveLength(gatewayDNSLogsFixture.records.length);
    expect(records[0].DeviceID).toBe(gatewayDNSLogsFixture.records[0].DeviceID);
    // Fractional seconds are floored to a whole-second "Z" timestamp.
    expect(capturedUrl).toContain('start=2026-07-29T00%3A00%3A00Z');
  });

  test('throws CloudflareLogsError on a non-2xx response', async () => {
    __setLogsFetchForTests(async () => new Response('forbidden', { status: 403 }));
    await expect(
      logsRetrieve('2026-07-29T00:00:00Z', '2026-07-30T00:00:00Z', 'gateway_dns'),
    ).rejects.toBeInstanceOf(CloudflareLogsError);
  });

  test('throws InvalidTimeRangeError on an unparseable timestamp', async () => {
    __setLogsFetchForTests(async () => new Response('', { status: 200 }));
    await expect(
      logsRetrieve('not-a-date', '2026-07-30T00:00:00Z', 'gateway_http'),
    ).rejects.toBeInstanceOf(InvalidTimeRangeError);
  });
});
