import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { cloudforceOneFixture } from '../fixtures/index.ts';
import { getCloudforceOneConfig, useFixtures } from '../lib/config.ts';
import { fetchWithRetry, fetchWithTimeout } from '../lib/http.ts';
import { asJson } from '../lib/json.ts';

/**
 * Cloudforce One threat-event enrichment (OPTIONAL).
 *
 * Cloudforce One is Cloudflare's managed threat-intelligence service. Unlike
 * the generic reputation lookup in ./intel.ts, it provides curated, ATTRIBUTED
 * events: which named actor / campaign an indicator belongs to, MITRE ATT&CK
 * mapping, kill-chain phase, and analyst insight.
 *
 * We query Threat Events by indicator:
 *   GET /accounts/{id}/cloudforce-one/events?search=[{field:indicator,op:in,value:[...]}]
 *
 * This tool is READ-ONLY and only runs when CLOUDFORCE_ONE_API_TOKEN is set;
 * otherwise it returns { available: false } and the agent proceeds without it.
 *
 * [verify] The exact GET encoding of the `search` array-of-object parameter and
 * the `datasetId=all` semantics should be confirmed against a live Cloudforce
 * One account. On any query error this tool degrades to status "lookup_failed"
 * (never a false "no threat") so a coverage gap is always visible.
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface RawThreatEvent {
  uuid: string;
  indicator: string;
  indicatorType?: string;
  category?: string;
  event?: string;
  attacker?: string;
  attackerCountry?: string;
  killChain?: number;
  mitreAttack?: string[];
  tags?: string[];
  tlp?: string;
  insight?: string;
  date?: string;
}

export type ThreatEvent = {
  uuid: string;
  indicator: string;
  indicatorType?: string;
  category?: string;
  event?: string;
  attacker?: string;
  attackerCountry?: string;
  killChain?: number;
  mitreAttack?: string[];
  tags?: string[];
  tlp?: string;
  insight?: string;
  date?: string;
};

/**
 * matched       — one or more attributed threat events reference this indicator.
 * no_match      — Cloudforce One has no events for this indicator (a real,
 *                 meaningful result — not an error).
 * lookup_failed — the query errored; coverage is unknown for this indicator.
 */
export type CloudforceOneEntry = {
  indicator: string;
  status: 'matched' | 'no_match' | 'lookup_failed';
  events: ThreatEvent[];
  error?: string;
};

export type CloudforceOneResult =
  | { available: false; reason: string }
  | { available: true; results: Record<string, CloudforceOneEntry> };

function normalize(raw: RawThreatEvent): ThreatEvent {
  return {
    uuid: raw.uuid,
    indicator: raw.indicator,
    indicatorType: raw.indicatorType,
    category: raw.category,
    event: raw.event,
    attacker: raw.attacker || undefined,
    attackerCountry: raw.attackerCountry || undefined,
    killChain: raw.killChain,
    mitreAttack: raw.mitreAttack?.filter((m) => m.trim().length > 0),
    tags: raw.tags?.filter((t) => t.trim().length > 0),
    tlp: raw.tlp,
    insight: raw.insight || undefined,
    date: raw.date,
  };
}

async function queryThreatEvents(
  accountId: string,
  apiToken: string,
  dataset: string,
  indicators: string[],
): Promise<RawThreatEvent[]> {
  const params = new URLSearchParams({ datasetId: dataset, pageSize: '100' });
  // Bulk indicator lookup via the documented `search` filter (op:'in').
  params.append('search[0][field]', 'indicator');
  params.append('search[0][op]', 'in');
  for (const indicator of indicators) params.append('search[0][value][]', indicator);

  const url = `${CF_API_BASE}/accounts/${accountId}/cloudforce-one/events?${params}`;
  const res = await fetchWithRetry(() =>
    fetchWithTimeout(url, { headers: { Authorization: `Bearer ${apiToken}` } }),
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new Error(`Cloudforce One ${res.status}: ${body}`);
  }
  const json = (await res.json()) as RawThreatEvent[] | { result?: RawThreatEvent[] };
  // The events endpoint returns a bare array; tolerate a v4 envelope too.
  return Array.isArray(json) ? json : (json.result ?? []);
}

export const getCloudforceOneEvents = defineTool({
  name: 'get_cloudforce_one_events',
  description:
    'Query Cloudflare Cloudforce One for ATTRIBUTED threat events referencing the given IPs/domains. ' +
    'Returns, per indicator, any matching events with named attacker, category, MITRE ATT&CK mapping, ' +
    'kill-chain phase, tags, TLP, and analyst insight. Optional: if Cloudforce One is not configured, ' +
    'returns { available: false } and the investigation continues without attributed intel. ' +
    'Per-indicator status is "matched", "no_match", or "lookup_failed" (coverage unknown, not clean).',
  input: v.object({
    indicators: v.pipe(
      v.array(v.string()),
      v.description('IP addresses and/or domain names to look up in Cloudforce One'),
    ),
  }),
  async run({ data }) {
    if (useFixtures()) {
      const results: Record<string, CloudforceOneEntry> = {};
      for (const indicator of data.indicators) {
        results[indicator] = cloudforceOneFixture[indicator] ?? {
          indicator,
          status: 'no_match',
          events: [],
        };
      }
      return asJson({ available: true, results } satisfies CloudforceOneResult);
    }

    const config = getCloudforceOneConfig();
    if (!config) {
      return asJson({ available: false, reason: 'CLOUDFORCE_ONE_API_TOKEN not set' } satisfies CloudforceOneResult);
    }

    const results: Record<string, CloudforceOneEntry> = {};
    for (const indicator of data.indicators) {
      results[indicator] = { indicator, status: 'no_match', events: [] };
    }

    try {
      const events = await queryThreatEvents(
        config.accountId,
        config.apiToken,
        config.dataset,
        data.indicators,
      );
      const byIndicator = new Map(data.indicators.map((i) => [i.toLowerCase(), i]));
      for (const raw of events) {
        const key = byIndicator.get(String(raw.indicator).toLowerCase());
        if (!key) continue;
        const entry = results[key];
        entry.status = 'matched';
        entry.events.push(normalize(raw));
      }
    } catch (err) {
      // Coverage is now unknown for the whole batch — surface it rather than
      // reporting a misleading "no_match".
      const message = err instanceof Error ? err.message : String(err);
      for (const indicator of data.indicators) {
        results[indicator] = { indicator, status: 'lookup_failed', events: [], error: message };
      }
    }

    return asJson({ available: true, results } satisfies CloudforceOneResult);
  },
});
