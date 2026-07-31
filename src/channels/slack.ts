import { createSlackChannel } from '@flue/slack';
import { getSlackConfig } from '../lib/config.ts';

// Slack ingress for the deployed Worker. You implement the events handler in
// Step 8 (Connect to Slack); until then this is a no-op channel that still
// mounts cleanly in `app.ts`.
//
// An empty signingSecret (SLACK_SIGNING_SECRET unset) makes verification fail
// closed — rejecting rather than trusting unverified webhooks.
export const channel = createSlackChannel({
  signingSecret: getSlackConfig().signingSecret,
  // TODO Step 8: filter for app_mention, build a SlackThreadRef, and dispatch a
  //   signal to a per-thread ZeroTrustInvestigator instance seeded with the thread.
  async events() {},
});
