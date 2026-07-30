import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { logsRetrieve } from '../lib/logs-client.ts';
import { filterRecords } from './filter.ts';
import { asJson } from '../lib/json.ts';

// access_requests Logpush record (PascalCase). https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/access_requests/
export interface AccessRequestRecord {
  Action: string;                       // 'login' | 'logout'
  Allowed: boolean;
  AppDomain: string;
  AppUUID: string;
  Connection: string;                   // identity provider (e.g. 'google-workspace')
  Country: string;                      // 2-letter ISO country code
  CreatedAt: string;
  Email: string;
  IPAddress: string;
  RayID: string;
  UserUID: string;
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
    // TODO Step 2: implement this tool.
    // 1. Fetch raw access_requests records for the window:
    //      logsRetrieve<AccessRequestRecord>(data.fromTime, data.toTime, 'access_requests')
    // 2. Narrow to this user + window with filterRecords(records, {
    //      email: data.userEmail, fromTime: data.fromTime, toTime: data.toTime,
    //      emailKey: 'Email', timeKey: 'CreatedAt' })
    // 3. return asJson({ records: filtered, total: filtered.length, dataset: 'access_requests' })
    // The building blocks (logsRetrieve, filterRecords, asJson) are imported above.
    void data;
    throw new Error('Not implemented — complete this in Step 2');
  },
});
