import { createChannelRouter, setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { ZeroTrustInvestigator } from './agents/zero-trust-investigator.ts';
import { channel } from './channels/slack.ts';

// Route model calls through the named AI Gateway for logging/rate-limiting/budget.
// Response caching is intentionally left off (Gateway default): every triage must
// reflect live reasoning, never a stale cached LLM response.
setProvider(
  cloudflareBindingProvider({
    binding: env.AI,
    gateway: {
      id: 'zt-investigator', // must match the gateway name in your CF dashboard
    },
  }),
);

const app = new Hono();

app.route('/agents/zero-trust-investigator', createAgentRouter(ZeroTrustInvestigator));

// Slack ingress at /channels/slack/events — point Slack's Event Subscriptions URL
// here (app_mention). Wrapped in createChannelRouter so the returned Hono is typed
// against this app's hono version (@flue/slack bundles an older, incompatible one).
app.route('/channels/slack', createChannelRouter(channel.routes));

export default app;
