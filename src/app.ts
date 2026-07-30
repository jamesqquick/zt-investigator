import { createChannelRouter, setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { ZeroTrustInvestigator } from './agents/zero-trust-investigator.ts';
import { channel } from './channels/slack.ts';

// Route all model calls through the named AI Gateway for request logging,
// rate limiting, and budget controls in the Cloudflare dashboard.
// Create the gateway at: dash.cloudflare.com -> AI -> AI Gateway
//
// Response caching is intentionally NOT enabled here. This is a security
// investigation tool: every triage must reflect live reasoning over the
// current data, and re-running an investigation must never be served a stale
// cached LLM response. We leave cache behavior at the Gateway default (off)
// rather than setting cacheTtl.
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

// Slack ingress: mounts /channels/slack/events (+ /interactions, /commands when
// configured). Point your Slack app's Event Subscriptions request URL here and
// subscribe to the app_mention event.
// Equivalent to `channel.route()` (both build the same mountable sub-router),
// but routed through the runtime's createChannelRouter so the returned Hono is
// typed against the app's hono version. @flue/slack bundles an older hono whose
// route() return type trips app.route()'s parameter check under this dep set.
app.route('/channels/slack', createChannelRouter(channel.routes));

export default app;
