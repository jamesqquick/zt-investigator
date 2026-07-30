import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { gatewayDNSLogsFixture, gatewayHTTPLogsFixture } from '../fixtures/index.ts';
import { useFixtures } from '../lib/config.ts';
import { logsRetrieve } from '../lib/cf-client.ts';
import { filterRecords } from './filter.ts';
import { asJson } from '../lib/json.ts';

/**
 * Native Logpush gateway_dns record shape (PascalCase).
 * Docs: https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/gateway_dns/
 */
export type GatewayDNSRecord = {
  AccountID: string;
  ApplicationName: string;
  CategoryNames: string[];
  Datetime: string;                 // ISO 8601
  DeviceID: string;                 // WARP device UUID — use this to call get_device_posture
  DeviceName: string;
  Email: string;                    // user email
  QueryName: string;                // queried domain
  QueryType: string;                // A, AAAA, CNAME, etc.
  ResolverDecision: string;         // allowedOnNoPolicyMatch | blockedByCategory | allowedByPolicy | etc.
  Action: string;                   // allow | block
  PolicyName?: string;
  ResolvedIPs?: string[];
};

/**
 * Native Logpush gateway_http record shape (PascalCase).
 * Docs: https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/account/gateway_http/
 */
export type GatewayHTTPRecord = {
  AccountID: string;
  Action: string;                         // allow | block | isolate | etc.
  ApplicationNames: string[];
  CategoryNames: string[];
  Datetime: string;
  DestinationIP: string;
  DestinationIPCountryCode: string;
  DeviceID: string;
  DeviceName: string;
  DownloadMatchedDlpProfiles: string[];
  Email: string;
  HTTPHost: string;
  HTTPMethod: string;
  HTTPStatusCode: number;
  PolicyName?: string;
  URL: string;
  UserID?: string;
};

const timeWindowInput = v.object({
  userEmail: v.pipe(v.string(), v.email(), v.description('User email address to filter on')),
  fromTime: v.pipe(v.string(), v.description('ISO 8601 window start')),
  toTime: v.pipe(v.string(), v.description('ISO 8601 window end')),
});

export const getGatewayDNSLogs = defineTool({
  name: 'get_gateway_dns_logs',
  description:
    'Fetch Cloudflare Gateway DNS query logs for a user via Logs Engine (Logpush → R2). ' +
    'Returns records with: QueryName, ResolverDecision, Action, CategoryNames, DeviceID, DeviceName, Datetime. ' +
    'DeviceID can be passed to get_device_posture for device details.',
  input: timeWindowInput,
  async run({ data }) {
    const records = useFixtures()
      ? gatewayDNSLogsFixture.records
      : await logsRetrieve<GatewayDNSRecord>(data.fromTime, data.toTime, 'gateway_dns');

    const filtered = filterRecords(records, {
      email: data.userEmail,
      fromTime: data.fromTime,
      toTime: data.toTime,
      emailKey: 'Email',
      timeKey: 'Datetime',
    });

    return asJson({
      records: filtered,
      total: filtered.length,
      dataset: 'gateway_dns',
    });
  },
});

export const getGatewayHTTPLogs = defineTool({
  name: 'get_gateway_http_logs',
  description:
    'Fetch Cloudflare Gateway HTTP request logs for a user via Logs Engine (Logpush → R2). ' +
    'Returns records with: URL, HTTPHost, Action, CategoryNames, DeviceID, DeviceName, ' +
    'DownloadMatchedDlpProfiles, DestinationIP, Datetime.',
  input: timeWindowInput,
  async run({ data }) {
    const records = useFixtures()
      ? gatewayHTTPLogsFixture.records
      : await logsRetrieve<GatewayHTTPRecord>(data.fromTime, data.toTime, 'gateway_http');

    const filtered = filterRecords(records, {
      email: data.userEmail,
      fromTime: data.fromTime,
      toTime: data.toTime,
      emailKey: 'Email',
      timeKey: 'Datetime',
    });

    return asJson({
      records: filtered,
      total: filtered.length,
      dataset: 'gateway_http',
    });
  },
});
