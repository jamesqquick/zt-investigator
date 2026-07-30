import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { ZeroTrustInvestigator } from './agents/zero-trust-investigator.ts';

// This is the Worker entry point (used by `vite dev` and `wrangler deploy`).
// Step 1 runs the agent locally with `flue run`, which does not need this file —
// you will wire the pieces below in the deploy/Slack steps.

// TODO Step 7 (Deploy): route model calls through Workers AI + a named AI Gateway
//   with setProvider(cloudflareBindingProvider({ binding: env.AI, gateway: { id: 'zt-investigator' } })).

const app = new Hono();

app.route('/agents/zero-trust-investigator', createAgentRouter(ZeroTrustInvestigator));

// TODO Step 8 (Slack): mount the Slack channel router so app_mention events reach
//   the agent — app.route('/channels/slack', createChannelRouter(channel.routes)).

export default app;
