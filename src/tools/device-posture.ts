import { defineTool } from '@flue/runtime';
import * as v from 'valibot';
import { getCloudflareApiConfig } from '../lib/config.ts';
import { getCloudflareClient } from '../lib/cf-client.ts';
import { asJson } from '../lib/json.ts';

// Device shape from GET /accounts/{id}/devices/physical-devices/{device_id}.
// https://developers.cloudflare.com/api/resources/zero_trust/subresources/devices/
// NOTE: Cloudflare does not expose per-check posture pass/fail via API — this
// returns device identity and OS metadata only. Input DeviceID comes from Gateway logs.
export type PhysicalDevice = {
  id: string;
  name: string;
  created_at: string;
  last_seen_at: string;
  updated_at: string;
  active_registrations: number;
  client_version?: string;
  deleted_at?: string | null;
  device_type?: string;         // mac | windows | linux | android | ios | chromeos
  hardware_id?: string;
  mac_address?: string;
  manufacturer?: string;
  model?: string;
  os_version?: string;
  os_version_extra?: string;
  serial_number?: string;
  last_seen_user?: {
    id?: string;
    email?: string;
    name?: string;
  };
};

export const getDevicePosture = defineTool({
  name: 'get_device_posture',
  description:
    'Fetch WARP device details for a device ID from Cloudflare Zero Trust fleet. ' +
    'Returns: name, device_type, os_version, manufacturer, model, last_seen_at, last_seen_user. ' +
    'Get the DeviceID from Gateway DNS or HTTP log records. ' +
    'Note: per-check posture results (disk encryption, firewall, etc.) are not available via the Cloudflare API.',
  input: v.object({
    deviceId: v.pipe(
      v.string(),
      v.description('WARP device ID — available as DeviceID in Gateway DNS/HTTP log records'),
    ),
  }),
  async run({ data }) {
    const { accountId } = getCloudflareApiConfig();
    // Physical-devices lookup lives on the nested `devices.devices` SDK resource.
    const device = (await getCloudflareClient().zeroTrust.devices.devices.get(data.deviceId, {
      account_id: accountId,
    })) as PhysicalDevice;

    return asJson({
      result: device,
      success: true,
    });
  },
});
