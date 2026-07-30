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

    // Channel deliveries are signals, not user messages: a Slack thread is a
    // multi-participant surface the agent joins as one member, so the event is
    // carried with its metadata intact rather than presenting every sender as
    // the agent's own user. `attributes` are set by this verified webhook code,
    // so tools/instructions can trust them (see useDelivery in the agent).
    const attributes: Record<string, string> = { eventId: payload.event_id };
    if (event.user) attributes.requestedBy = event.user;

    // One agent instance per Slack thread; seed the thread so the report
    // tool can post its findings back to the same thread.
    await dispatch(ZeroTrustInvestigator, {
      id: channel.instanceId(thread),
      initialData: thread,
      message: {
        kind: 'signal',
        type: 'slack.app_mention',
        body: cleanMention(event.text ?? ''),
        attributes,
      },
    });
  },
});
