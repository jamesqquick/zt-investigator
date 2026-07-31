import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getCloudflareClient } from '../lib/cf-client.ts';
import { getCloudflareApiConfig } from '../lib/config.ts';
import { asJson } from '../lib/json.ts';

// AccessRequest record from GET /accounts/{id}/access/logs/access_requests.
// https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/logs/subresources/access_requests/methods/list/
// Fields are snake_case (SDK type) — no DeviceID; use Gateway logs for device linkage.
export interface AccessRequestRecord {
  action?: string;           // 'login' | 'logout'
  allowed?: boolean;
  app_domain?: string;
  app_uid?: string;
  connection?: string;       // identity provider (e.g. 'google-workspace')
  created_at?: string;
  ip_address?: string;
  ray_id?: string;
  user_email?: string;
}

export const getAccessLogs = defineTool({
  name: 'get_access_logs',
  description:
    'Fetch Cloudflare Access authentication logs for a user via the Access Logs API (no R2/Logpush required). ' +
    'Returns up to 300 login/logout events: allowed, app_domain, ip_address, created_at. ' +
    'Note: access_requests has no DeviceID — use Gateway logs for device linkage.',
  input: v.object({
    userEmail: v.pipe(v.string(), v.email(), v.description('User email address to filter on')),
    fromTime: v.pipe(v.string(), v.description('ISO 8601 window start')),
    toTime: v.pipe(v.string(), v.description('ISO 8601 window end')),
  }),
  async run({ data }) {
    // TODO Step 2: implement this tool via the Access Logs API.
    // 1. const { accountId } = getCloudflareApiConfig();
    // 2. call getCloudflareClient().zeroTrust.access.logs.accessRequests.list({
    //      account_id: accountId, email: data.userEmail, emailOp: 'eq',
    //      since: data.fromTime, until: data.toTime, limit: 300, direction: 'desc' })
    // 3. return asJson({ records: records as AccessRequestRecord[],
    //      total: records.length, dataset: 'access_requests' })
    // The building blocks (getCloudflareClient, getCloudflareApiConfig, asJson) are imported above.
    void data;
    throw new Error('Not implemented — complete this in Step 2');
  },
});
