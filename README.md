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

## What you get — the end result

One mention produces one **triage report**, posted straight back to the Slack
thread as a Block Kit card (or to the run output when running locally):

- **Risk level** — `low` / `medium` / `high` / `critical`, from a documented
  scoring framework (see [`src/skills/triage/SKILL.md`](src/skills/triage/SKILL.md)).
- **Summary** — one sentence: what happened and why it matters.
- **Key findings** — the 3–5 signals that drove the score, most important first.
- **Access event** — the triggering login: app, allow/deny, country + IP, time.
- **Gateway activity** — notable DNS/HTTP records in the window (blocks, DLP hits).
- **Device posture** — the WARP device identity and OS metadata behind the session.
- **Threat-intel hits** — reputation hits and attributed-actor matches per indicator.
- **Recommended action** — one clear next step for the security team.

A core trust property: **a coverage gap never scores as clean.** If any intel
lookup errors, that indicator is reported as `lookup_failed` (unresolved) — it is
surfaced to the analyst and never quietly lowers the risk level.

## Cloudflare products used

The agent is a thin orchestration layer over Cloudflare's Zero Trust and threat
platforms. Each tool maps to a real product and use case:

| Product | Role in the investigation | Surfaced via |
|---|---|---|
| **Cloudflare One** | The Zero Trust / SASE platform being investigated — the umbrella over Access, Gateway, and WARP. | — |
| **Cloudflare Access** (ZTNA) | Who authenticated to which app, allow vs. deny, origin country, source IP. | `access_requests` logs |
| **Cloudflare Gateway** (SWG) | DNS and HTTP filtering decisions, blocked categories, DLP profile matches, and device linkage. | `gateway_dns` + `gateway_http` logs |
| **WARP / Zero Trust devices** | The enrolled device behind the session — name, type, OS version, last seen. | Zero Trust devices API |
| **Logpush → R2 + Logs Engine** | How the three log datasets are stored and queried (R2 log retrieval). | `/logs/retrieve` over R2 |
| **Cloudflare Intelligence / Security Center** | Baseline IOC reputation — "is this IP/domain generically bad?" (ASN, threat lists, domain categories). Always on. | `/intel/ip`, `/intel/domain` |
| **Cloudforce One** (optional) | Attributed threat events — named actor/campaign, MITRE ATT&CK, kill-chain phase, analyst insight. | `/cloudforce-one/events` |
| **Cloudflare Workers** | Runtime and deploy target; hosts the Slack ingress and the agent router. | `src/app.ts` |
| **Durable Objects** | One durable, stateful investigation instance per Slack thread. | Flue agent DO |
| **Workers AI + AI Gateway** | Routes deployed model calls for logging, rate limiting, and budget control. Caching is intentionally off. | `setProvider` in `src/app.ts` |

Slack is the only non-Cloudflare surface — it's the ingress (an `app_mention`
event) and the delivery target for the finished report.

## Architecture

```
Slack @mention
   └─ Worker (Hono) → dispatch → ZeroTrustInvestigator agent (one DO instance per thread)
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

The request lifecycle:

1. A verified Slack `app_mention` webhook hits the Worker's Hono router
   (`/channels/slack/events`).
2. The channel handler `dispatch`es the `ZeroTrustInvestigator` agent, keyed to
   the Slack thread — so each thread gets **one Durable Object instance** that
   the report can post back into. The requesting user's id is attached as
   trusted `attributes` (from verified webhook code, never model input).
3. The agent loads the **triage** skill, which orchestrates the investigation:
   delegate data collection, extract indicators, link the device, delegate
   enrichment, then score.
4. Two subagents do the fan-out. **cf-data-collector** gathers the Cloudflare
   Zero Trust data; **threat-intel** enriches the indicators found in it.
5. `post_triage_report` delivers the scored report to the originating thread.

It's built on the **Flue** agent runtime, which supplies the primitives used
throughout: `useSkill`, `useSubagent`, `useTool`, `useDelivery`, and durable
tool steps (`step.do`) so an interrupted report is replayed, never re-posted.

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
against local sample data, with no Cloudflare or Slack credentials. The fixtures
are checked into the repo under [`src/fixtures/`](src/fixtures/), so
`pnpm install` plus an OpenAI key is all you need.

```bash
pnpm install
cp .env.example .env          # USE_FIXTURES=true is the default
# set OPENAI_API_KEY in .env (the model still runs locally)
pnpm run agent -- "investigate alice@corp.com"
```

The triage report prints to the run output.

## Live mode (real Cloudflare data)

Set `USE_FIXTURES=false` and provide the Cloudflare credentials below. The data
tools then call the real Logs Engine, Zero Trust devices, and Intel APIs. A
single `CF_API_TOKEN` with **Account Intel Read, Zero Trust Read, and Logs Read**
covers the baseline flow (Cloudforce One uses its own optional token).

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
