import { defineSubagent, useTool } from '@flue/runtime';
import { getAccessLogs } from '../tools/access-logs.ts';
import { getGatewayDNSLogs, getGatewayHTTPLogs } from '../tools/gateway-logs.ts';
import { getDevicePosture } from '../tools/device-posture.ts';

function CfDataCollector() {
  // TODO Step 3: register the four data tools with useTool(...):
  //   getAccessLogs, getGatewayDNSLogs, getGatewayHTTPLogs, getDevicePosture
  // then return an instruction telling this subagent to gather ALL Cloudflare
  // Zero Trust data for the user + window and return one structured bundle.
  return 'TODO: implement in Step 3';
}

export const cfDataCollector = defineSubagent({
  name: 'cf-data-collector',
  description:
    'Fetches Access logs, Gateway DNS/HTTP logs, and device posture from Cloudflare Zero Trust for a given user.',
  agent: CfDataCollector,
});
