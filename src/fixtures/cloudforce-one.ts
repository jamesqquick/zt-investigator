import type { CloudforceOneEntry } from '../tools/cloudforce-one.ts';

export const cloudforceOneFixture: Record<string, CloudforceOneEntry> = {
  'malware-c2-domain.ru': {
    indicator: 'malware-c2-domain.ru',
    status: 'matched',
    events: [
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
        insight:
          'Infrastructure attributed to Salt Typhoon; historically used to exfiltrate credential stores from HR and finance systems.',
        date: '2026-07-20T00:00:00Z',
      },
    ],
  },
  '185.220.101.45': {
    indicator: '185.220.101.45',
    status: 'no_match',
    events: [],
  },
  'pastebin.com': {
    indicator: 'pastebin.com',
    status: 'no_match',
    events: [],
  },
};
