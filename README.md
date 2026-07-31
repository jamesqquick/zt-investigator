# zt-investigator

A Zero Trust security-investigation agent for **Cloudflare One**. Mention it in
Slack — `@zt-investigator investigate alice@corp.com` — and it pulls the user's
Access, Gateway DNS/HTTP, and device signals, enriches any indicators with
Cloudflare threat intelligence, scores the risk, and posts a CISO-ready triage
report back to the thread.

Built on [Flue](https://www.npmjs.com/package/@flue/runtime) and deployed as a
Cloudflare Worker, with one Durable Object per investigation.

## The problem it solves

A real Zero Trust investigation is a scavenger hunt across consoles. To answer
"is this login suspicious?" an analyst has to pull the user's **Access**
authentication events, cross-reference their **Gateway** DNS and HTTP activity,
check the **device** they came from, and then paste every source IP and domain
into a threat-intel tool — and finally hand-correlate all of it into a verdict.

This agent collapses that loop into a single Slack mention. It does the pivoting
and correlation the way an analyst would, and returns a structured risk
assessment in seconds instead of the manual back-and-forth across four surfaces.

## What you get

One mention produces one **triage report** posted back to the Slack thread:

- **Risk level** — `low` / `medium` / `high` / `critical`
- **Summary** — one sentence: what happened and why it matters
- **Key findings** — the 3–5 signals that drove the score
- **Access event** — the triggering login: app, allow/deny, country + IP, time
- **Gateway activity** — notable DNS/HTTP records in the window (blocks, DLP hits)
- **Device posture** — the WARP device identity and OS metadata
- **Threat-intel hits** — reputation hits and attributed-actor matches per indicator
- **Recommended action** — one clear next step for the security team

A core trust property: **a coverage gap never scores as clean.** If any intel
lookup errors, that indicator is reported as `lookup_failed` — surfaced to the
analyst and never quietly used to lower the risk level.

## Architecture

```
Slack @mention
   └─ Worker (Hono) → dispatch → ZeroTrustInvestigator agent (one DO per thread)
        ├─ skill: triage        (process + risk-scoring framework)
        ├─ subagent: cf-data-collector
        │     ├─ get_access_logs
        │     ├─ get_gateway_dns_logs
        │     ├─ get_gateway_http_logs
        │     └─ get_device_posture
        ├─ subagent: threat-intel
        │     ├─ get_indicator_intel        (Cloudflare Intel — always on)
        │     └─ get_cloudforce_one_events  (Cloudforce One — optional)
        └─ tool: post_triage_report
```

Cloudflare products in play: **Access**, **Gateway**, **WARP**, **Logpush → R2**
(log storage), **Cloudflare Intel / Security Center** (baseline IOC reputation),
**Cloudforce One** (optional attributed threat events), **Workers**, **Durable
Objects**, and **Workers AI + AI Gateway**.

## Quick start (no credentials)

Fixture mode runs the full agent flow against local sample data — no Cloudflare
or Slack credentials needed, just an OpenAI key.

```bash
pnpm install
cp .env.example .env          # FIXTURE_MODE=true is the default
# set OPENAI_API_KEY in .env
pnpm run agent -- "investigate alice@corp.com"
```

The triage report prints to the run output.

## Live mode

Leave `FIXTURE_MODE` unset and provide real Cloudflare credentials. A single
`CF_API_TOKEN` with **Account Intel Read, Zero Trust Read, and Logs Read + Edit**
covers the baseline flow.

```bash
pnpm run agent -- "investigate alice@corp.com"
```

## Deploy to Cloudflare Workers

```bash
pnpm exec wrangler deploy
```

Set secrets with `wrangler secret put`, then point your Slack app's Event
Subscriptions URL at `https://<worker>/channels/slack/events` and subscribe to
`app_mention`.

Deployed model calls route through the `zt-investigator` AI Gateway (create it
under AI → AI Gateway). Response caching is intentionally off — investigations
must reflect live reasoning.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `FIXTURE_MODE` | – | `true` runs fully offline against local fixtures. |
| `MODEL` | – | `provider/model`. Default `openai/gpt-4o`. |
| `OPENAI_API_KEY` | local | Required when `MODEL=openai/gpt-4o`. |
| `CF_API_TOKEN` | live | Account Intel Read, Zero Trust Read, Logs Read + Edit. |
| `CF_ACCOUNT_ID` | live | Cloudflare account ID. |
| `CF_R2_ACCESS_KEY_ID` / `CF_R2_SECRET_ACCESS_KEY` | live | Logs Engine retrieval. |
| `CLOUDFORCE_ONE_API_TOKEN` | optional | Enables attributed threat events. |
| `SLACK_SIGNING_SECRET` | Slack | Webhook verification. Unset ⇒ fails closed. |
| `SLACK_BOT_TOKEN` | Slack | Posting reports. Unset ⇒ falls back to run output. |
