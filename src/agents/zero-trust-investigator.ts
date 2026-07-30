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
  // Local (flue run): MODEL=openai/gpt-4o  — uses OPENAI_API_KEY directly.
  // Deployed (Cloudflare Worker): MODEL=cloudflare/openai/gpt-4o — routes
  // through AI Gateway via the Worker AI binding, no OPENAI_API_KEY needed.
  useModel(getModel());
  // When triggered from Slack, dispatch seeds the originating thread as
  // creation data (validated by the initialData static below); the report tool
  // posts back to it. Undefined under `flue run`, where reports go to run output.
  const slackThread = useInitialData<v.InferOutput<typeof ZeroTrustInvestigator.initialData>>();
  useSkill(triageSkill);
  useTool(createTriageReportTool(slackThread));
  useSubagent(cfDataCollector);
  useSubagent(threatIntel);

  // Trusted requester identity: the Slack channel attaches the requesting
  // user's id to the signal's `attributes` in verified webhook code, never
  // from model input. Surface it so the triage report can attribute who asked.
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

// Validate the Slack thread creation data once, at instance creation. Optional
// so local `flue run` (no Slack thread) still works, while a malformed Slack
// dispatch fails fast at admission instead of seeding a broken conversation.
ZeroTrustInvestigator.initialData = v.optional(
  v.object({
    teamId: v.string(),
    channelId: v.string(),
    threadTs: v.string(),
  }),
);
