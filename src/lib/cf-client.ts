/**
 * Shared Cloudflare API client.
 *
 * Credentials are resolved and validated in `./config.ts` — never read or
 * hardcoded here. All outbound calls go through `./http.ts` so they inherit a
 * hard timeout, and read-only calls additionally get one bounded retry.
 */

import {
  getCloudflareApiConfig,
  getLogsConfig,
  type LogDataset,
} from './config.ts';
import { fetchWithRetry, fetchWithTimeout } from './http.ts';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class CloudflareAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
  ) {
    super(`Cloudflare API ${status} on ${endpoint}: ${message}`);
    this.name = 'CloudflareAPIError';
  }
}

export class InvalidTimeRangeError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: string,
  ) {
    super(`Invalid ${field}: "${value}" is not a valid RFC 3339 / ISO 8601 timestamp.`);
    this.name = 'InvalidTimeRangeError';
  }
}

/**
 * Normalize a model-supplied ISO 8601 timestamp to the strict RFC 3339 form the
 * Logs Engine expects: whole seconds, UTC "Z" (e.g. `2022-06-06T16:00:00Z`).
 * Throws InvalidTimeRangeError on an unparseable value so a bad time window
 * fails fast with a clear message instead of an opaque upstream 4xx.
 */
function toRfc3339(value: string, field: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new InvalidTimeRangeError(field, value);
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.000Z$/, 'Z');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseV4Response<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new CloudflareAPIError(res.status, endpoint, body);
  }
  const json = (await res.json()) as {
    success: boolean;
    result: T;
    errors?: Array<{ message: string }>;
  };
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join('; ') ?? 'unknown error';
    throw new CloudflareAPIError(res.status, endpoint, msg);
  }
  return json.result;
}

// ---------------------------------------------------------------------------
// REST API — standard /accounts/{id}/... endpoints (read-only: retried)
// ---------------------------------------------------------------------------

export async function cfFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { apiToken, accountId } = getCloudflareApiConfig();
  const url = `${CF_API_BASE}/accounts/${accountId}${path}`;
  const res = await fetchWithRetry(() =>
    fetchWithTimeout(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    }),
  );
  return parseV4Response<T>(res, path);
}

/**
 * Like cfFetch, but authenticated with an explicit token — used by Cloudforce
 * One, which carries its own (optional) API token distinct from CF_API_TOKEN.
 */
export async function cfFetchWithToken<T = unknown>(
  accountId: string,
  apiToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${CF_API_BASE}/accounts/${accountId}${path}`;
  const res = await fetchWithRetry(() =>
    fetchWithTimeout(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    }),
  );
  return parseV4Response<T>(res, path);
}

// ---------------------------------------------------------------------------
// Logs Engine — streams NDJSON from R2 and returns parsed records
// Docs: https://developers.cloudflare.com/logs/r2-log-retrieval/
// ---------------------------------------------------------------------------

export async function logsRetrieve<T = Record<string, unknown>>(
  start: string,
  end: string,
  dataset: LogDataset,
): Promise<T[]> {
  const cfg = getLogsConfig();
  const prefix = cfg.prefixFor(dataset);

  const params = new URLSearchParams({
    start: toRfc3339(start, 'fromTime'),
    end: toRfc3339(end, 'toTime'),
    bucket: cfg.bucket,
    prefix,
  });
  const endpoint = `/logs/retrieve?${params}`;
  const url = `${CF_API_BASE}/accounts/${cfg.accountId}${endpoint}`;

  const res = await fetchWithRetry(() =>
    fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        'R2-Access-Key-Id': cfg.r2AccessKeyId,
        'R2-Secret-Access-Key': cfg.r2SecretAccessKey,
      },
    }),
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new CloudflareAPIError(res.status, endpoint, body);
  }

  const ndjson = await res.text();
  return ndjson
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}
