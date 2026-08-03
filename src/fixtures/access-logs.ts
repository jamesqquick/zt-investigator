import type { AccessRequestRecord } from '../tools/access-logs.ts';

export const accessLogsFixture: {
  records: AccessRequestRecord[];
  total: number;
  dataset: string;
} = {
  records: [
    {
      action: 'login',
      allowed: false,
      app_domain: 'hr-dashboard.company.com',
      app_uid: 'app-uuid-hr-001',
      connection: 'google-workspace',
      created_at: '2026-07-29T02:47:00Z',
      user_email: 'employee@company.com',
      ip_address: '185.220.101.45',
      ray_id: 'ray-8a1b2c3d4e5f0001',
    },
    {
      action: 'login',
      allowed: false,
      app_domain: 'hr-dashboard.company.com',
      app_uid: 'app-uuid-hr-001',
      connection: 'google-workspace',
      created_at: '2026-07-29T02:46:12Z',
      user_email: 'employee@company.com',
      ip_address: '185.220.101.45',
      ray_id: 'ray-8a1b2c3d4e5f0002',
    },
    {
      action: 'login',
      allowed: false,
      app_domain: 'eng-ops.company.com',
      app_uid: 'app-uuid-eng-002',
      connection: 'google-workspace',
      created_at: '2026-07-29T02:45:30Z',
      user_email: 'employee@company.com',
      ip_address: '185.220.101.45',
      ray_id: 'ray-8a1b2c3d4e5f0003',
    },
  ],
  total: 3,
  dataset: 'access_requests',
};
