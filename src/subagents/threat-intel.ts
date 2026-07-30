import { defineSubagent, useTool } from '@flue/runtime';
import { cloudforceOneEnabled } from '../lib/config.ts';
import { getIndicatorIntel } from '../tools/intel.ts';
import { getCloudforceOneEvents } from '../tools/cloudforce-one.ts';

function ThreatIntelAgent() {
  useTool(getIndicatorIntel);
  if (cloudforceOneEnabled()) useTool(getCloudforceOneEvents);

  const lines = [
    'Enrich a list of IP addresses and domains with Cloudflare threat intelligence.',
    'First call get_indicator_intel for baseline reputation (ASN, ip_lists membership, domain categories).',
  ];
  if (cloudforceOneEnabled()) {
    lines.push(
      'Then call get_cloudforce_one_events for attributed threat events (named actor, MITRE ATT&CK, kill chain, analyst insight).',
    );
  }
  lines.push(
    'Return a structured report per indicator. Preserve each indicator\'s status: an "enriched"/"matched" result is a verdict, ' +
      'but "lookup_failed" means the indicator could not be evaluated — report it as unknown, never as clean.',
  );
  return lines.join(' ');
}

export const threatIntel = defineSubagent({
  name: 'threat-intel',
  description:
    'Enriches IPs and domains with Cloudflare Intelligence reputation and (when configured) Cloudforce One attributed threat events. Use after collecting Cloudflare data to enrich any suspicious indicators found.',
  agent: ThreatIntelAgent,
});
