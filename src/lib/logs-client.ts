// Logs Engine client — streams NDJSON from R2. https://developers.cloudflare.com/logs/r2-log-retrieval/
// Stays raw (not the cloudflare SDK): /logs/retrieve needs R2 credential headers
// and returns newline-delimited JSON, not the standard {success,result,errors} envelope.
import { getLogsConfig, type LogDataset } from './config.ts';
import { buildFixtureLogsFetch } from '../fixtures/runtime.ts';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry, fetchWithTimeout } from './http.ts';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareLogsError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
  ) {
    super(`Cloudflare Logs ${status} on ${endpoint}: ${message}`);
    this.name = 'CloudflareLogsError';
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

// Normalize an ISO 8601 timestamp to the strict RFC 3339 the Logs Engine expects
// (whole seconds, UTC "Z"). Throws on an unparseable value so a bad time window
// fails fast instead of an opaque upstream 4xx.
function toRfc3339(value: string, field: string): string {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new InvalidTimeRangeError(field, value);
  return new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.000Z$/, 'Z');
}

// Tests swap in a fake fetch so log retrieval stays offline; undefined in prod.
let injectedFetch: typeof fetch | undefined;

// FIXTURE_MODE (offline): supply placeholder R2 creds at load so getLogsConfig
// succeeds. The fake NDJSON fetch is installed lazily in logsRetrieve.
const FIXTURE_MODE = process.env.FIXTURE_MODE === 'true';
if (FIXTURE_MODE) {
  process.env.CF_API_TOKEN ||= 'fixture';
  process.env.CF_ACCOUNT_ID ||= 'fixture';
  process.env.CF_R2_ACCESS_KEY_ID ||= 'fixture';
  process.env.CF_R2_SECRET_ACCESS_KEY ||= 'fixture';
}

export function __setLogsFetchForTests(fetchImpl: typeof fetch | undefined): void {
  injectedFetch = fetchImpl;
}

export async function logsRetrieve<T = Record<string, unknown>>(
  start: string,
  end: string,
  dataset: LogDataset,
): Promise<T[]> {
  if (FIXTURE_MODE && !injectedFetch) injectedFetch = buildFixtureLogsFetch();
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
    fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${cfg.apiToken}`,
          'R2-Access-Key-Id': cfg.r2AccessKeyId,
          'R2-Secret-Access-Key': cfg.r2SecretAccessKey,
        },
      },
      DEFAULT_TIMEOUT_MS,
      injectedFetch ?? fetch,
    ),
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)');
    throw new CloudflareLogsError(res.status, endpoint, body);
  }

  const ndjson = await res.text();
  return ndjson
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}
