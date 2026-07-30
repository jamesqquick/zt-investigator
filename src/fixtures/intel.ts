import type { IntelEntry } from '../tools/intel.ts';

/**
 * Fixture: Cloudflare Intelligence (Security Center) reputation results in the
 * normalized shape returned by get_indicator_intel.
 *
 * is_threat=true on the IP (non-empty risk_types) and on the C2 domain.
 * pastebin.com is is_threat=false — legitimate site, but context matters.
 * Every entry carries status: 'enriched' (the lookup succeeded).
 */
export const intelFixture: Record<string, IntelEntry> = {
  '185.220.101.45': {
    indicator: '185.220.101.45',
    kind: 'ip',
    status: 'enriched',
    is_threat: true,
    asn: {
      number: 24940,
      description: 'HETZNER-AS',
      country: 'DE',
      type: 'hosting_provider',
    },
    risk_types: ['Anonymizer', 'Botnet, Command and Control'],
  },
  'malware-c2-domain.ru': {
    indicator: 'malware-c2-domain.ru',
    kind: 'domain',
    status: 'enriched',
    is_threat: true,
    content_categories: ['Malware', 'Command and Control'],
    application: null,
    resolves_to: ['91.108.4.1'],
    risk_score: 1,
    risk_types: ['Malware'],
  },
  'pastebin.com': {
    indicator: 'pastebin.com',
    kind: 'domain',
    status: 'enriched',
    is_threat: false,
    content_categories: ['File Sharing', 'Technology'],
    application: null,
    resolves_to: ['104.20.1.23'],
    risk_score: 0,
  },
};
