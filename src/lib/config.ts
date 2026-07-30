/**
 * Single source of truth for runtime configuration.
 *
 * Every env var the agent reads is resolved and validated here, so a
 * misconfiguration surfaces as one clear, aggregated error instead of an
 * opaque failure deep inside an API call. On Cloudflare, Flue resolves
 * secrets through `nodejs_compat`'s `process.env`, so that is the mechanism
 * used here too (set them as Wrangler vars/secrets when deployed, or in
 * `.env` for local `flue run`).
 *
 * Access model:
 *   - Cloudflare data credentials fail LOUDLY when live mode needs them.
 *   - Slack fails CLOSED (missing signing secret => request verification
 *     rejects) rather than crashing the Worker at boot.
 *   - Cloudforce One is OPTIONAL: getCloudforceOneConfig() returns null when
 *     its token is absent, and the enrichment step is skipped.
 */

export class MissingConfigError extends Error {
  constructor(
    public readonly vars: string[],
    context: string,
  ) {
    super(`Missing required configuration: ${vars.join(', ')}. ${context}`);
    this.name = 'MissingConfigError';
  }
}

export class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

/** Read an env var, treating empty / whitespace-only values as unset. */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Fixtures & model
// ---------------------------------------------------------------------------

/** When true, tools return local fixtures instead of calling real APIs. */
export function useFixtures(): boolean {
  return process.env.USE_FIXTURES === 'true';
}

/**
 * Model specifier, e.g. `openai/gpt-4o` (local) or `cloudflare/openai/gpt-4o`
 * (routed through the Workers AI binding / AI Gateway when deployed).
 */
export function getModel(): `${string}/${string}` {
  const raw = process.env.MODEL ?? 'openai/gpt-4o';
  if (!/^[^/]+\/.+$/.test(raw)) {
    throw new InvalidConfigError(
      `MODEL must be in "provider/model" form (e.g. "openai/gpt-4o"), got "${raw}".`,
    );
  }
  return raw as `${string}/${string}`;
}

// ---------------------------------------------------------------------------
// Cloudflare REST API (Access device lookup, Intel) — apiToken + accountId
// ---------------------------------------------------------------------------

export interface CloudflareApiConfig {
  apiToken: string;
  accountId: string;
}

export function getCloudflareApiConfig(): CloudflareApiConfig {
  const apiToken = read('CF_API_TOKEN');
  const accountId = read('CF_ACCOUNT_ID');
  const missing: string[] = [];
  if (!apiToken) missing.push('CF_API_TOKEN');
  if (!accountId) missing.push('CF_ACCOUNT_ID');
  if (missing.length > 0) {
    throw new MissingConfigError(
      missing,
      'Required for live Cloudflare API calls. Set them as Worker secrets/vars ' +
        '(or in .env for local runs), or set USE_FIXTURES=true.',
    );
  }
  return { apiToken: apiToken!, accountId: accountId! };
}

// ---------------------------------------------------------------------------
// Logs Engine (Logpush -> R2) — adds R2 keys, bucket, and dataset prefixes
// ---------------------------------------------------------------------------

export type LogDataset = 'access_requests' | 'gateway_dns' | 'gateway_http';

const DEFAULT_PREFIXES: Record<LogDataset, string> = {
  access_requests: 'access_requests/{DATE}',
  gateway_dns: 'gateway_dns/{DATE}',
  gateway_http: 'gateway_http/{DATE}',
};

const PREFIX_ENV: Record<LogDataset, string> = {
  access_requests: 'CF_ACCESS_LOG_PREFIX',
  gateway_dns: 'CF_GATEWAY_DNS_PREFIX',
  gateway_http: 'CF_GATEWAY_HTTP_PREFIX',
};

export interface LogsConfig extends CloudflareApiConfig {
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  bucket: string;
  prefixFor(dataset: LogDataset): string;
}

export function getLogsConfig(): LogsConfig {
  const api = getCloudflareApiConfig();
  const r2AccessKeyId = read('CF_R2_ACCESS_KEY_ID');
  const r2SecretAccessKey = read('CF_R2_SECRET_ACCESS_KEY');
  const missing: string[] = [];
  if (!r2AccessKeyId) missing.push('CF_R2_ACCESS_KEY_ID');
  if (!r2SecretAccessKey) missing.push('CF_R2_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    throw new MissingConfigError(
      missing,
      'Required for Logs Engine (Logpush -> R2) retrieval, or set USE_FIXTURES=true.',
    );
  }
  return {
    ...api,
    r2AccessKeyId: r2AccessKeyId!,
    r2SecretAccessKey: r2SecretAccessKey!,
    bucket: read('CF_LOG_BUCKET') ?? 'zt-investigator-logs',
    prefixFor: (dataset) => read(PREFIX_ENV[dataset]) ?? DEFAULT_PREFIXES[dataset],
  };
}

// ---------------------------------------------------------------------------
// Cloudforce One (OPTIONAL) — Threat Events queried by indicator
// ---------------------------------------------------------------------------

export interface CloudforceOneConfig {
  apiToken: string;
  accountId: string;
  /** Dataset(s) to query. 'all' searches every event dataset in the account. */
  dataset: string;
}

/**
 * Returns Cloudforce One config only when CLOUDFORCE_ONE_API_TOKEN is set —
 * otherwise null, which callers treat as "skip Cloudforce One enrichment".
 * Requires CF_ACCOUNT_ID to also be present (throws if the token is set but
 * the account id is missing, since that is a genuine misconfiguration).
 */
export function getCloudforceOneConfig(): CloudforceOneConfig | null {
  const apiToken = read('CLOUDFORCE_ONE_API_TOKEN');
  if (!apiToken) return null;
  const accountId = read('CF_ACCOUNT_ID');
  if (!accountId) {
    throw new MissingConfigError(
      ['CF_ACCOUNT_ID'],
      'CLOUDFORCE_ONE_API_TOKEN is set but CF_ACCOUNT_ID is missing.',
    );
  }
  return {
    apiToken,
    accountId,
    dataset: read('CF_CLOUDFORCE_ONE_DATASET') ?? 'all',
  };
}

/** True when Cloudforce One enrichment is available (token present, or fixtures). */
export function cloudforceOneEnabled(): boolean {
  return useFixtures() || read('CLOUDFORCE_ONE_API_TOKEN') !== undefined;
}

// ---------------------------------------------------------------------------
// Slack — fails closed rather than crashing the Worker
// ---------------------------------------------------------------------------

export interface SlackConfig {
  /** Empty string when unset — verification then rejects (fail closed). */
  signingSecret: string;
  /** Undefined when unset — the report tool falls back to run output. */
  botToken: string | undefined;
}

export function getSlackConfig(): SlackConfig {
  return {
    signingSecret: read('SLACK_SIGNING_SECRET') ?? '',
    botToken: read('SLACK_BOT_TOKEN'),
  };
}
