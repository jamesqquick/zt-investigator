'use agent';
import { useModel } from '@flue/runtime';
import * as v from 'valibot';
import '../observability.ts';
import { getModel } from '../lib/config.ts';

// A Flue agent is just a function. Hooks (useModel, useTool, useSkill, ...) declare
// what the agent can do; the returned string is the system prompt it runs with.
// Each `flue run` / dispatch gets its own isolated instance (a Durable Object).
export function ZeroTrustInvestigator() {
  // MODEL is provider/model. Local uses the provider key directly (e.g.
  // openai/gpt-4o); deployed uses cloudflare/openai/gpt-4o to route via AI Gateway.
  useModel(getModel());

  // TODO Step 2: give the agent its first tool — useTool(getAccessLogs)
  // TODO Step 3: delegate to subagents — useSubagent(cfDataCollector) / useSubagent(threatIntel)
  // TODO Step 4: add judgment with a Skill — useSkill(triageSkill)
  // TODO Step 5: report the verdict — useTool(createTriageReportTool(...)) + useDelivery()

  return [
    'You are a Zero Trust security investigator. Investigate the given user and report your findings.',
    'If the user does not specify a time window, default to the last 7 days ending at the current time.',
    'Compute concrete ISO 8601 fromTime/toTime values yourself and pass them to the data tools — never stop to ask for a time range.',
  ].join(' ');
}

ZeroTrustInvestigator.agentName = 'zero-trust-investigator';

// Optional so local `flue run` works with no Slack thread; a malformed Slack
// dispatch fails fast at admission instead of seeding a broken conversation.
// The agent starts using this data in Step 5 (useInitialData) / Step 8 (Slack).
ZeroTrustInvestigator.initialData = v.optional(
  v.object({
    teamId: v.string(),
    channelId: v.string(),
    threadTs: v.string(),
  }),
);
