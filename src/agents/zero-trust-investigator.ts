'use agent';
import { useDelivery, useInitialData, useModel, useSkill, useSubagent, useTool } from '@flue/runtime';
import * as v from 'valibot';
import '../observability.ts';
import { getModel } from '../lib/config.ts';
import { cfDataCollector } from '../subagents/cf-data-collector.ts';
import { threatIntel } from '../subagents/threat-intel.ts';
import { createTriageReportTool } from '../tools/slack-report.ts';
import triageSkill from '../skills/triage/SKILL.md';

export function ZeroTrustInvestigator() {
  // MODEL is provider/model. Local uses the provider key directly (e.g.
  // openai/gpt-4o); deployed uses cloudflare/openai/gpt-4o to route via AI Gateway.
  useModel(getModel());
  // Set from the originating Slack thread (validated by initialData below) so the
  // report tool can post back; undefined under `flue run`.
  const slackThread = useInitialData<v.InferOutput<typeof ZeroTrustInvestigator.initialData>>();
  useSkill(triageSkill);
  useTool(createTriageReportTool(slackThread));
  useSubagent(cfDataCollector);
  useSubagent(threatIntel);

  // Trusted requester identity: set on the signal's `attributes` by verified
  // webhook code, never from model input. Surfaced so the report can attribute who asked.
  const delivery = useDelivery();
  const requestedBy = delivery.kind === 'signal' ? delivery.attributes?.requestedBy : undefined;

  return [
    'You are a Zero Trust security investigator. Investigate the given user and report your findings.',
    requestedBy ? `This investigation was requested by Slack user <@${requestedBy}>.` : '',
    'If the user does not specify a time window, default to the last 7 days ending at the current time.',
    'Compute concrete ISO 8601 fromTime/toTime values yourself and pass them to the data tools — never stop to ask for a time range.',
  ]
    .filter(Boolean)
    .join(' ');
}

ZeroTrustInvestigator.agentName = 'zero-trust-investigator';

// Optional so local `flue run` works with no Slack thread; a malformed Slack
// dispatch fails fast at admission instead of seeding a broken conversation.
ZeroTrustInvestigator.initialData = v.optional(
  v.object({
    teamId: v.string(),
    channelId: v.string(),
    threadTs: v.string(),
  }),
);
