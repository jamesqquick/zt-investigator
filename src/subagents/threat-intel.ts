import { defineSubagent, useTool } from '@flue/runtime';
import { cloudforceOneEnabled } from '../lib/config.ts';
import { getIndicatorIntel } from '../tools/intel.ts';
import { getCloudforceOneEvents } from '../tools/cloudforce-one.ts';

function ThreatIntelAgent() {
  // TODO Step 3: register get_indicator_intel with useTool(getIndicatorIntel).
  // Gate the premium feed behind config: if (cloudforceOneEnabled()) useTool(getCloudforceOneEvents).
  // Return per-indicator enrichment instructions. Critical contract: a "lookup_failed"
  // indicator is UNKNOWN, never clean — preserve each indicator's status in the report.
  return 'TODO: implement in Step 3';
}

export const threatIntel = defineSubagent({
  name: 'threat-intel',
  description:
    'Enriches IPs and domains with Cloudflare Intelligence reputation and (when configured) Cloudforce One attributed threat events. Use after collecting Cloudflare data to enrich any suspicious indicators found.',
  agent: ThreatIntelAgent,
});
