# Live-account readiness checklist

Everything below is what a real Cloudflare account + Slack workspace needs before
`zt-investigator` can run against live data. The demo runs today in fixture mode
(`USE_FIXTURES=true`) with `tsc --noEmit` clean and 43/43 tests passing; this
checklist is the path from fixtures to a live investigation.

Bring it up in this order — each stage is independently verifiable, so a failure
is isolated to the thing you just changed.

---

## 0. Baseline (no account needed)

- [ ] `pnpm install`
- [ ] `pnpm run typecheck` — clean
- [ ] `pnpm run test` — 43/43 pass
- [ ] `pnpm run dev` with `USE_FIXTURES=true` and confirm a fixture investigation end-to-end

---

## 1. Cloudflare token scopes

One `CF_API_TOKEN` covers the baseline flow (Cloudforce One uses its own optional token).

- [ ] **Account Intel Read** — `/intel/ip`, `/intel/domain`
- [ ] **Zero Trust Read** — `/devices/physical-devices/{id}`
- [ ] **Logs Read _and_ Edit** — `/logs/retrieve`
- [ ] *(optional)* **Cloudforce One Read** — `/cloudforce-one/events` (separate `CF_CLOUDFORCE_ONE_TOKEN`)

> ⚠️ **Doc discrepancy — verify on your account.** The Logs Engine `/logs/retrieve`
> endpoint documents token auth as requiring **Logs Edit** (Logpull), even though
> retrieval is read-only. Grant Logs Read + Edit, or fall back to
> `X-Auth-Email` / `X-Auth-Key` with Logshare read.

---

## 2. Logs infrastructure (Logpush → R2)

The log tools read pre-exported logs from R2 via the Logs Engine `/logs/retrieve`
endpoint. Those objects only exist if Logpush is writing them.

- [ ] R2 bucket `zt-investigator-logs` exists
- [ ] R2 access key (read) provisioned and set in env
- [ ] Logpush jobs writing to that bucket, one per dataset:
  - [ ] `access_requests`
  - [ ] `gateway_dns`
  - [ ] `gateway_http`
- [ ] Object prefix layout is `{dataset}/{DATE}` (must match `prefixFor(dataset)` in `src/lib/cf-client.ts`)
- [ ] At least one day of real traffic has landed in the bucket

> ⚠️ **Operational risk.** `/logs/retrieve` can return **422** on high-volume time
> windows and has **no pagination**. Keep investigation windows narrow (the tools
> already pass `fromTime`/`toTime`), and expect empty results until Logpush has
> backfilled the requested window.

> ✅ **Fixed:** `fromTime`/`toTime` are now normalized + validated to **RFC 3339**
> before the retrieve call (`toRfc3339` in `cf-client.ts`); a bad range throws
> `InvalidTimeRangeError` instead of silently sending a malformed query.

---

## 3. AI Gateway

- [ ] An AI Gateway named **exactly** `zt-investigator` exists in the account
      (the name is referenced directly in config — a mismatch fails silently at model-call time)

---

## 4. Slack app

- [ ] Slack app created
- [ ] Bot scope **`chat:write`**
- [ ] Event subscription **`app_mention`**
- [ ] Request URL points at the deployed worker: `…/channels/slack/events`
- [ ] **Signing secret** set in env
- [ ] Bot invited to the channel you'll test in

---

## 5. Environment variables

Fill in `.env` (see `.env.example`) for live mode:

- [ ] `USE_FIXTURES=false`
- [ ] `CF_API_TOKEN` (scopes from §1)
- [ ] `CF_ACCOUNT_ID`
- [ ] R2 bucket + R2 read key values
- [ ] AI Gateway name (`zt-investigator`)
- [ ] Slack signing secret + bot token
- [ ] *(optional)* `CF_CLOUDFORCE_ONE_TOKEN`

---

## 6. Contracts to confirm against live responses

These are verified against current Cloudflare docs but worth a live spot-check,
since the docs and live API have already diverged once (see §7).

- [ ] **IP intel** `/intel/ip` returns `risk_types` (and `belongs_to_ref`) — the
      verdict now keys off `risk_types`, not the old `ip_lists`.
- [ ] **Domain intel** `/intel/domain` returns `application.name` and `risk_types`.
- [ ] **Cloudforce One** `search[...]` bracket-encoding on the GET query and
      `datasetId=all` semantics — the client safe-degrades if the shape differs,
      but confirm you actually get events back (`src/tools/cloudforce-one.ts` has
      an open `[verify]` note here).
- [ ] **Devices** `/devices/physical-devices/{id}` — exact-match lookup returns
      the expected device shape.

---

## 7. Fixed in this pass (context for reviewers)

- **IP intel scoring bug (critical).** Live `/intel/ip` returns `risk_types` +
  `belongs_to_ref`, not `ip_lists`/`ptr_lookup`. The old code keyed `is_threat`
  off `ip_lists`, so **every IP scored clean in live mode**. Rewrote the types and
  `enrichIP`/`enrichDomain`, added a `riskTypeNames` helper, and typed
  `belongs_to_ref.value` as a **string** (ASN). Fixtures + the triage SKILL were
  updated to the new shape.
- **Timestamp validation.** `logsRetrieve` now normalizes/validates start/end to
  RFC 3339 first (see §2).
- **Docs.** README + `.env.example` token-scope wording corrected; fixture-only
  `notes` field removed from the intel model.
