import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { accessLogsFixture } from '../fixtures/index.ts';
import { useFixtures } from '../lib/config.ts';
import { logsRetrieve } from '../lib/cf-client.ts';
import { filterRecords } from './filter.ts';
import { asJson } from '../lib/json.ts';

/**
 * Native Logpush access_requests record shape (PascalCase).
 * Docs: https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/access_requests/
 */
export interface AccessRequestRecord {
  Action: string;                       // 'login' | 'logout'
  Allowed: boolean;                     // true = permitted, false = denied
  AppDomain: string;                    // domain of the protected application
  AppUUID: string;                      // Access application UUID
  Connection: string;                   // identity provider used (e.g. 'google-workspace')
  Country: string;                      // 2-letter ISO country code of request origin
  CreatedAt: string;                    // ISO 8601 timestamp
  Email: string;                        // authenticating user email
  IPAddress: string;                    // client source IP
  RayID: string;                        // Cloudflare Ray ID
  UserUID: string;                      // Cloudflare user UID
  PurposeJustificationResponse?: string;
}

export const getAccessLogs = defineTool({
  name: 'get_access_logs',
  description:
    'Fetch Cloudflare Access authentication logs for a user via Logs Engine (Logpush → R2). ' +
    'Returns login/logout events per application: Allowed (bool), AppDomain, Country, IPAddress, CreatedAt. ' +
    'Note: there is no DeviceID on access_requests — use Gateway logs for device linkage.',
  input: v.object({
    userEmail: v.pipe(v.string(), v.email(), v.description('User email address to filter on')),
    fromTime: v.pipe(v.string(), v.description('ISO 8601 window start')),
    toTime: v.pipe(v.string(), v.description('ISO 8601 window end')),
  }),
  async run({ data }) {
    const records = useFixtures()
      ? accessLogsFixture.records
      : await logsRetrieve<AccessRequestRecord>(data.fromTime, data.toTime, 'access_requests');

    // Filter by user + time window in both paths so fixture mode behaves like
    // live mode (the live Logs Engine query is not scoped to a single user).
    const filtered = filterRecords(records, {
      email: data.userEmail,
      fromTime: data.fromTime,
      toTime: data.toTime,
      emailKey: 'Email',
      timeKey: 'CreatedAt',
    });

    return asJson({
      records: filtered,
      total: filtered.length,
      dataset: 'access_requests',
    });
  },
});
