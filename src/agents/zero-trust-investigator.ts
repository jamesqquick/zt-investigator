'use agent';
import { useInitialData, useModel, useSkill, useSubagent, useTool } from '@flue/runtime';
import type { SlackThreadRef } from '@flue/slack';
import '../observability.ts';
import { getModel } from '../lib/config.ts';
import { cfDataCollector } from '../subagents/cf-data-collector.ts';
import { threatIntel } from '../subagents/threat-intel.ts';
import { createTriageReportTool } from '../tools/slack-report.ts';
import triageSkill from '../skills/triage/SKILL.md';

export function ZeroTrustInvestigator() {
  // Local (flue run): MODEL=openai/gpt-4o  — uses OPENAI_API_KEY directly.
  // Deployed (Cloudflare Worker): MODEL=cloudflare/openai/gpt-4o — routes
  // through AI Gateway via the Worker AI binding, no OPENAI_API_KEY needed.
  useModel(getModel());
  // When triggered from Slack, dispatch seeds the originating thread as
  // creation data; the report tool posts back to it. Undefined under `flue run`.
  const slackThread = useInitialData<SlackThreadRef | undefined>();
  useSkill(triageSkill);
  useTool(createTriageReportTool(slackThread));
  useSubagent(cfDataCollector);
  useSubagent(threatIntel);
  return [
    'You are a Zero Trust security investigator. Investigate the given user and report your findings.',
    'If the user does not specify a time window, default to the last 7 days ending at the current time.',
    'Compute concrete ISO 8601 fromTime/toTime values yourself and pass them to the data tools — never stop to ask for a time range.',
  ].join(' ');
}

ZeroTrustInvestigator.agentName = 'zero-trust-investigator';
