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

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function getModel(): `${string}/${string}` {
  const raw = process.env.MODEL ?? 'openai/gpt-4o';
  if (!/^[^/]+\/.+$/.test(raw)) {
    throw new InvalidConfigError(
      `MODEL must be in "provider/model" form (e.g. "openai/gpt-4o"), got "${raw}".`,
    );
  }
  return raw as `${string}/${string}`;
}

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
        '(or in .env for local runs).',
    );
  }
  return { apiToken: apiToken!, accountId: accountId! };
}

// gateway_dns and gateway_http still flow through Logpush → R2.
// access_requests is now fetched directly via the Access Logs API.
export type LogDataset = 'gateway_dns' | 'gateway_http';

const DEFAULT_PREFIXES: Record<LogDataset, string> = {
  gateway_dns: 'gateway_dns/{DATE}',
  gateway_http: 'gateway_http/{DATE}',
};

const PREFIX_ENV: Record<LogDataset, string> = {
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
      'Required for Logs Engine (Logpush -> R2) retrieval.',
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

export interface CloudforceOneConfig {
  apiToken: string;
  accountId: string;
  /** Dataset(s) to query. 'all' searches every event dataset in the account. */
  dataset: string;
}

// Returns null when CLOUDFORCE_ONE_API_TOKEN is unset (callers skip enrichment).
// Throws if the token is set but CF_ACCOUNT_ID is missing — a real misconfig.
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

export function cloudforceOneEnabled(): boolean {
  return read('CLOUDFORCE_ONE_API_TOKEN') !== undefined;
}

export interface SlackConfig {
  /** Empty string when unset — verification then rejects (fail closed). */
  signingSecret: string;
  botToken: string | undefined;
}

export function getSlackConfig(): SlackConfig {
  return {
    signingSecret: read('SLACK_SIGNING_SECRET') ?? '',
    botToken: read('SLACK_BOT_TOKEN'),
  };
}
