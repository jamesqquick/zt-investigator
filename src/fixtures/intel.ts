import type { IntelEntry } from '../tools/intel.ts';

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
