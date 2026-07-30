# zt-investigator

A Zero Trust security-investigation agent for Cloudflare One. Mention it in Slack
("investigate alice@corp.com") and it pulls the user's Access, Gateway DNS/HTTP,
and device signals, enriches any indicators with Cloudflare threat intelligence,
scores the risk, and posts a CISO-ready triage report back to the thread.

Built on [Flue](https://www.npmjs.com/package/@flue/runtime) and deployed as a
Cloudflare Worker (one Durable Object per investigation).

## How it works

```
Slack @mention
   └─ dispatch → ZeroTrustInvestigator agent (one DO instance per thread)
        ├─ skill: triage        (process + risk-scoring framework)
        ├─ subagent: cf-data-collector
        │     ├─ get_access_logs        (Logs Engine: access_requests)
        │     ├─ get_gateway_dns_logs   (Logs Engine: gateway_dns)
        │     ├─ get_gateway_http_logs  (Logs Engine: gateway_http)
        │     └─ get_device_posture     (Zero Trust devices API)
        ├─ subagent: threat-intel
        │     ├─ get_indicator_intel        (Cloudflare Intel / Security Center — always on)
        │     └─ get_cloudforce_one_events  (Cloudforce One attributed events — optional)
        └─ tool: post_triage_report   (Slack Block Kit, or run output locally)
```

### Threat intelligence is dual-source

- **Baseline reputation** (`get_indicator_intel`) — Cloudflare Intel / Security
  Center. "Is this IP/domain generically bad?" (ASN, threat-list membership,
  domain categories). Always available.
- **Attributed events** (`get_cloudforce_one_events`) — Cloudforce One. "Is this
  indicator tied to a named actor/campaign?" (attacker, MITRE ATT&CK, kill-chain
  phase, TLP, analyst insight). **Optional and read-only** — only runs when
  `CLOUDFORCE_ONE_API_TOKEN` is set; otherwise the tool returns
  `{ available: false }` and the investigation proceeds without it.

Every indicator carries an explicit **status**. A lookup that errors becomes
`lookup_failed`, never a silent "clean" — a coverage gap is always visible to the
analyst and never lowers the risk score.

## Quick start (no credentials)

Fixture mode runs the entire agent flow — delegation, scoring, reporting —
against local sample data, with no Cloudflare or Slack credentials.

```bash
pnpm install
cp .env.example .env          # USE_FIXTURES=true is the default
# set OPENAI_API_KEY in .env (the model still runs locally)
pnpm run agent -- "investigate alice@corp.com"
```

The triage report prints to the run output.

## Live mode (real Cloudflare data)

Set `USE_FIXTURES=false` and provide the Cloudflare credentials below. The data
tools then call the real Logs Engine, Zero Trust devices, and Intel APIs.

```bash
USE_FIXTURES=false pnpm run agent -- "investigate alice@corp.com"
```

## Deploy to Cloudflare Workers

```bash
pnpm exec wrangler deploy
```

Set the runtime secrets with `wrangler secret put` (or in the dashboard), then
point your Slack app's Event Subscriptions request URL at
`https://<worker>/channels/slack/events` and subscribe to `app_mention`.

- Local model calls use `MODEL=openai/gpt-4o` + `OPENAI_API_KEY`.
- Deployed calls use `MODEL=cloudflare/openai/gpt-4o`, routed through the Worker
  AI binding and the `zt-investigator` AI Gateway (create it under AI → AI
  Gateway). Response caching is intentionally left off — investigations must
  reflect live reasoning.

## Configuration

All configuration is validated in one place (`src/lib/config.ts`), so a
misconfiguration surfaces as a single clear error instead of an opaque failure
deep in an API call.

| Variable | Required | Purpose |
|---|---|---|
| `USE_FIXTURES` | – | `true` uses local fixtures (no credentials). Default in `.env.example`. |
| `MODEL` | – | `provider/model`. Default `openai/gpt-4o`. |
| `OPENAI_API_KEY` | local only | Needed when `MODEL=openai/gpt-4o`. |
| `CF_API_TOKEN` | live | Account Intel Read, Zero Trust Read, Logs Read. |
| `CF_ACCOUNT_ID` | live | Cloudflare account id. |
| `CF_R2_ACCESS_KEY_ID` / `CF_R2_SECRET_ACCESS_KEY` | live | Logs Engine (Logpush → R2) retrieval. |
| `CF_LOG_BUCKET` | – | R2 bucket for logs. Default `zt-investigator-logs`. |
| `CF_ACCESS_LOG_PREFIX` / `CF_GATEWAY_DNS_PREFIX` / `CF_GATEWAY_HTTP_PREFIX` | – | Override Logpush object prefixes. |
| `CLOUDFORCE_ONE_API_TOKEN` | optional | Enables Cloudforce One attributed events. Needs Cloudforce One Read. |
| `CF_CLOUDFORCE_ONE_DATASET` | – | Event dataset(s) to query. Default `all`. |
| `SLACK_SIGNING_SECRET` | Slack | Webhook verification. **Unset ⇒ verification fails closed.** |
| `SLACK_BOT_TOKEN` | Slack | Posting reports. Unset ⇒ reports fall back to run output. |

On Cloudflare, Flue resolves these through `nodejs_compat`'s `process.env`, so
set them as Wrangler vars/secrets when deployed, or in `.env` for local runs.

## Development

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run test        # vitest run
pnpm run dev         # vite dev
```

Tests (`test/`) run in a plain node environment via `vitest.config.ts` (kept
separate from `vite.config.ts` so the Worker/Flue plugins don't load under the
test runner). They cover config validation, indicator classification, the
`lookup_failed` contract, Cloudforce One gating, record filtering, report
formatting, and PII redaction.

## Notes to verify against a live account

A few API contracts are marked `[verify]` in the code and should be confirmed
against your own Cloudflare account before relying on live mode:

- Logs Engine object-prefix `{DATE}` partitioning (must match your Logpush jobs).
- Cloudforce One `search` GET encoding and `datasetId=all` semantics.
- The Intel API IPv6 query-parameter name (`ipv6`).

## Security

- Slack fails **closed**: an unset signing secret rejects unverified webhooks.
- Report delivery is never silently downgraded — a Slack-triggered investigation
  that can't post returns `delivered: "failed"` with the reason.
- The `flue run` activity log **redacts PII** (emails, IPs, device IDs) before
  writing to stderr.
- Cloudforce One access is **read-only** (Threat Events queried by indicator); no
  RFIs or writes are ever issued.
