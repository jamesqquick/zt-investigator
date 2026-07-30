import type { AccessRequestRecord } from '../tools/access-logs.ts';

export const accessLogsFixture: {
  records: AccessRequestRecord[];
  total: number;
  dataset: string;
} = {
  records: [
    {
      Action: 'login',
      Allowed: false,
      AppDomain: 'hr-dashboard.company.com',
      AppUUID: 'app-uuid-hr-001',
      Connection: 'google-workspace',
      Country: 'RO',
      CreatedAt: '2026-07-29T02:47:00Z',
      Email: 'james@company.com',
      IPAddress: '185.220.101.45',
      RayID: 'ray-8a1b2c3d4e5f0001',
      UserUID: 'uid-james-001',
    },
    {
      Action: 'login',
      Allowed: false,
      AppDomain: 'hr-dashboard.company.com',
      AppUUID: 'app-uuid-hr-001',
      Connection: 'google-workspace',
      Country: 'RO',
      CreatedAt: '2026-07-29T02:46:12Z',
      Email: 'james@company.com',
      IPAddress: '185.220.101.45',
      RayID: 'ray-8a1b2c3d4e5f0002',
      UserUID: 'uid-james-001',
    },
    {
      Action: 'login',
      Allowed: false,
      AppDomain: 'eng-ops.company.com',
      AppUUID: 'app-uuid-eng-002',
      Connection: 'google-workspace',
      Country: 'RO',
      CreatedAt: '2026-07-29T02:45:30Z',
      Email: 'james@company.com',
      IPAddress: '185.220.101.45',
      RayID: 'ray-8a1b2c3d4e5f0003',
      UserUID: 'uid-james-001',
    },
  ],
  total: 3,
  dataset: 'access_requests',
};
