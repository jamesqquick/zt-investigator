import { dispatch } from '@flue/runtime';
import { createSlackChannel, type SlackThreadRef } from '@flue/slack';
import { ZeroTrustInvestigator } from '../agents/zero-trust-investigator.ts';
import { getSlackConfig } from '../lib/config.ts';

// Strip leading bot @-mentions so the agent sees just the request text.
function cleanMention(text: string): string {
  return text.replace(/<@[^>]+>/g, '').trim();
}

// Resolved once at module init. When SLACK_SIGNING_SECRET is unset this is an
// empty string, which makes request verification fail closed (reject) rather
// than silently trusting unverified webhooks.
export const channel = createSlackChannel({
  signingSecret: getSlackConfig().signingSecret,
  async events({ payload }) {
    if (payload.type !== 'event_callback') return;
    if (payload.event.type !== 'app_mention') return;

    const event = payload.event;
    const thread: SlackThreadRef = {
      teamId: payload.team_id,
      channelId: event.channel,
      threadTs: event.thread_ts ?? event.ts,
    };

    // One agent instance per Slack thread; seed the thread so the report
    // tool can post its findings back to the same thread.
    await dispatch(ZeroTrustInvestigator, {
      id: channel.instanceId(thread),
      message: cleanMention(event.text ?? ''),
      initialData: thread,
    });
  },
});
