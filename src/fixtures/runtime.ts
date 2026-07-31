/**
 * Offline FIXTURE_MODE runtime.
 *
 * When FIXTURE_MODE=true the agent runs end-to-end with no live Cloudflare
 * access: cf-client and logs-client build a fake `cloudflare` SDK client and a
 * fake Logs Engine fetch from these factories (lazily, on first use) instead of
 * hitting the network. Crucially, the fakes return RAW API-shaped payloads, so
 * every request still exercises the real SDK→normalized mapping in the tools —
 * fixture mode tests the migration, it does not bypass it.
 *
 * This module depends only on config types + the fixture DATA (never on
 * cf-client or logs-client), so those modules import these factories without an
 * import cycle. Nothing here runs unless FIXTURE_MODE is set.
 */

import type Cloudflare from 'cloudflare';
import { accessLogsFixture } from './access-logs.ts';
import { cloudforceOneFixture } from './cloudforce-one.ts';
import { devicePostureFixture } from './device-posture.ts';
import { gatewayDNSLogsFixture, gatewayHTTPLogsFixture } from './gateway-logs.ts';
import type { LogDataset } from '../lib/config.ts';

// ---------------------------------------------------------------------------
// Raw API-shaped Intel responses (mirror /intel/ip and /intel/domain). These
// normalize back to src/fixtures/intel.ts when run through the intel tool.
// ---------------------------------------------------------------------------

const RAW_IP_INTEL: Record<string, Array<Record<string, unknown>>> = {
  '185.220.101.45': [
    {
      ip: '185.220.101.45',
      belongs_to_ref: {
        value: '24940',
        description: 'HETZNER-AS',
        country: 'DE',
        type: 'hosting_provider',
      },
      risk_types: [{ name: 'Anonymizer' }, { name: 'Botnet, Command and Control' }],
    },
  ],
};

const RAW_DOMAIN_INTEL: Record<string, Record<string, unknown>> = {
  'malware-c2-domain.ru': {
    domain: 'malware-c2-domain.ru',
    content_categories: [
      { id: 1, name: 'Malware' },
      { id: 2, name: 'Command and Control' },
    ],
    risk_score: 1,
    risk_types: [{ name: 'Malware' }],
    resolves_to_refs: [{ id: 'r1', value: '91.108.4.1' }],
  },
  'pastebin.com': {
    domain: 'pastebin.com',
    content_categories: [
      { id: 3, name: 'File Sharing' },
      { id: 4, name: 'Technology' },
    ],
    risk_score: 0,
    resolves_to_refs: [{ id: 'r2', value: '104.20.1.23' }],
  },
};

// Raw threat-event list (bare array, as the SDK returns). The normalized fixture
// events share the raw event shape, so reuse the attributed C2 event.
const RAW_THREAT_EVENTS = cloudforceOneFixture['malware-c2-domain.ru'].events;

// access_requests is now fetched via the SDK (not the Logs Engine), so it is
// wired into buildFixtureCloudflareClient below instead of this map.
const LOGS_BY_DATASET: Record<LogDataset, unknown[]> = {
  gateway_dns: gatewayDNSLogsFixture.records,
  gateway_http: gatewayHTTPLogsFixture.records,
};

// ---------------------------------------------------------------------------
// Fake builders
// ---------------------------------------------------------------------------

/** A fake `Cloudflare` returning raw fixture payloads for the read-only calls. */
export function buildFixtureCloudflareClient(): Cloudflare {
  return {
    intel: {
      ips: {
        get: async (params: { ipv4?: string; ipv6?: string }) => {
          const ip = params.ipv4 ?? params.ipv6 ?? '';
          return RAW_IP_INTEL[ip] ?? [];
        },
      },
      domains: {
        get: async (params: { domain: string }) =>
          // Unknown domains fall back to a bare record (enriched, not flagged).
          // The fixture set covers the demo indicators.
          RAW_DOMAIN_INTEL[params.domain] ?? { domain: params.domain },
      },
    },
    zeroTrust: {
      devices: {
        devices: {
          get: async () => devicePostureFixture.result,
        },
      },
      access: {
        logs: {
          accessRequests: {
            // Mirror the server-side filtering the real API performs so fixture
            // mode exercises the same code path as production.
            list: async (params: {
              email?: string;
              since?: string;
              until?: string;
            }) => {
              const target = (params.email ?? '').toLowerCase();
              const from = params.since ? Date.parse(params.since) : -Infinity;
              const to = params.until ? Date.parse(params.until) : Infinity;
              return accessLogsFixture.records.filter((r) => {
                if (target && r.user_email?.toLowerCase() !== target) return false;
                const ts = r.created_at ? Date.parse(r.created_at) : NaN;
                if (!Number.isNaN(ts)) {
                  if (ts < from || ts > to) return false;
                }
                return true;
              });
            },
          },
        },
      },
    },
    cloudforceOne: {
      threatEvents: {
        list: async () => RAW_THREAT_EVENTS,
      },
    },
  } as unknown as Cloudflare;
}

/** A fake fetch for the Logs Engine that returns NDJSON for the queried dataset. */
export function buildFixtureLogsFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const prefix = new URL(url).searchParams.get('prefix') ?? '';
    // prefixFor(dataset) is like "gateway_dns/{DATE}" — key off the leading token.
    const dataset = (Object.keys(LOGS_BY_DATASET) as LogDataset[]).find((d) =>
      prefix.startsWith(d),
    );
    const records = dataset ? LOGS_BY_DATASET[dataset] : [];
    const ndjson = records.map((r) => JSON.stringify(r)).join('\n');
    return new Response(ndjson, { status: 200 });
  }) as typeof fetch;
}
