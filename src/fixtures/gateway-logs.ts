import type { GatewayDNSRecord, GatewayHTTPRecord } from '../tools/gateway-logs.ts';

export const gatewayDNSLogsFixture: {
  records: GatewayDNSRecord[];
  total: number;
  dataset: string;
} = {
  records: [
    {
      AccountID: 'account-id-fixture',
      ApplicationName: '',
      CategoryNames: ['Malware', 'Command and Control'],
      Datetime: '2026-07-29T02:43:00Z',
      DeviceID: 'device-abc-123',
      DeviceName: 'MacBook-Pro-James',
      Email: 'james@company.com',
      QueryName: 'malware-c2-domain.ru',
      QueryType: 'A',
      ResolverDecision: 'blockedByCategory',
      Action: 'block',
      PolicyName: 'Block Malware',
      ResolvedIPs: [],
    },
    {
      AccountID: 'account-id-fixture',
      ApplicationName: 'Google',
      CategoryNames: [],
      Datetime: '2026-07-29T02:41:00Z',
      DeviceID: 'device-abc-123',
      DeviceName: 'MacBook-Pro-James',
      Email: 'james@company.com',
      QueryName: 'accounts.google.com',
      QueryType: 'A',
      ResolverDecision: 'allowedOnNoPolicyMatch',
      Action: 'allow',
      PolicyName: '',
      ResolvedIPs: ['142.250.80.141'],
    },
  ],
  total: 2,
  dataset: 'gateway_dns',
};

export const gatewayHTTPLogsFixture: {
  records: GatewayHTTPRecord[];
  total: number;
  dataset: string;
} = {
  records: [
    {
      AccountID: 'account-id-fixture',
      Action: 'block',
      ApplicationNames: ['Pastebin'],
      CategoryNames: ['File Sharing', 'Potentially Harmful'],
      Datetime: '2026-07-29T02:44:00Z',
      DestinationIP: '104.20.1.23',
      DestinationIPCountryCode: 'US',
      DeviceID: 'device-abc-123',
      DeviceName: 'MacBook-Pro-James',
      DownloadMatchedDlpProfiles: [],
      Email: 'james@company.com',
      HTTPHost: 'pastebin.com',
      HTTPMethod: 'GET',
      HTTPStatusCode: 403,
      PolicyName: 'Block File Sharing',
      URL: 'https://pastebin.com/raw/xK92mNpL',
    },
  ],
  total: 1,
  dataset: 'gateway_http',
};
