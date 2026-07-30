import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getCloudforceOneConfig } from '../lib/config.ts';
import { cfErrorNote, getCloudforceOneClient } from '../lib/cf-client.ts';
import { asJson } from '../lib/json.ts';

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

// status: matched (attributed events reference this indicator) | no_match (a
// real result, not an error) | lookup_failed (query errored, coverage unknown).
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
  const events = await getCloudforceOneClient(apiToken).cloudforceOne.threatEvents.list({
    account_id: accountId,
    datasetId: [dataset],
    pageSize: 100,
    search: [{ field: 'indicator', op: 'in', value: indicators }],
  });
  return (events ?? []) as unknown as RawThreatEvent[];
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
      const { notFound, note } = cfErrorNote(err);
      // 404 = dataset holds no events (real no_match, keep defaults). Any other
      // error = coverage unknown: surface it rather than a false "no_match".
      if (!notFound) {
        for (const indicator of data.indicators) {
          results[indicator] = { indicator, status: 'lookup_failed', events: [], error: note };
        }
      }
    }

    return asJson({ available: true, results } satisfies CloudforceOneResult);
  },
});
