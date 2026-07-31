import { Hono } from 'hono';

// This is the Worker entry point (used by `vite dev` and `wrangler deploy`).
// Steps 1-6 run the agent locally with `flue run`, which does not use this
// file. You wire it up when you deploy.

const app = new Hono();

// TODO Step 7 (Deploy): route model calls through Workers AI + a named AI Gateway
//   with setProvider(cloudflareBindingProvider({ binding: env.AI, gateway: { id: 'zt-investigator' } })),
//   then mount the agent router:
//     app.route('/agents/zero-trust-investigator', createAgentRouter(ZeroTrustInvestigator));

// TODO Step 8 (Slack): mount the Slack channel router so app_mention events reach
//   the agent — app.route('/channels/slack', createChannelRouter(channel.routes)).

export default app;
