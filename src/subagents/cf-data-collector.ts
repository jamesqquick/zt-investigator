import { defineSubagent, useTool } from '@flue/runtime';
import { getAccessLogs } from '../tools/access-logs.ts';
import { getGatewayDNSLogs, getGatewayHTTPLogs } from '../tools/gateway-logs.ts';
import { getDevicePosture } from '../tools/device-posture.ts';

function CfDataCollector() {
  useTool(getAccessLogs);
  useTool(getGatewayDNSLogs);
  useTool(getGatewayHTTPLogs);
  useTool(getDevicePosture);
  return 'Fetch all Cloudflare Zero Trust data for the given user and time window. Gather Access logs, Gateway DNS logs, Gateway HTTP logs, and device posture. Return a complete structured data bundle.';
}

export const cfDataCollector = defineSubagent({
  name: 'cf-data-collector',
  description: 'Fetches Access logs, Gateway DNS/HTTP logs, and device posture from Cloudflare Zero Trust for a given user.',
  agent: CfDataCollector,
});
