// NOTE: Cloudflare does not expose per-check posture pass/fail via API; the triage
// skill reasons about OS version, device type, and last_seen_at instead.
import type { PhysicalDevice } from '../tools/device-posture.ts';

export const devicePostureFixture: { result: PhysicalDevice; success: boolean } = {
  result: {
    id: 'device-abc-123',
    name: 'MacBook-Pro-Employee',
    active_registrations: 1,
    created_at: '2026-01-15T09:00:00Z',
    last_seen_at: '2026-07-29T02:47:30Z',
    updated_at: '2026-07-29T02:47:30Z',
    client_version: '2024.12.589.0',
    device_type: 'mac',
    manufacturer: 'Apple',
    model: 'MacBook Pro',
    os_version: '15.3.1',
    serial_number: 'C02ABC123DEF',
    last_seen_user: {
      id: 'uid-employee-001',
      email: 'employee@company.com',
      name: 'Employee',
    },
  },
  success: true,
};
