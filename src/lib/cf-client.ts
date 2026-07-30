import Cloudflare, { APIError } from 'cloudflare';
import { getCloudflareApiConfig } from './config.ts';
import { buildFixtureCloudflareClient } from '../fixtures/runtime.ts';

let defaultClient: Cloudflare | undefined;
let cloudforceOneClient: Cloudflare | undefined;
let testClient: Cloudflare | undefined;

// FIXTURE_MODE (offline): supply placeholder creds at load so the tools' config
// reads succeed. Read process.env DIRECTLY — calling an imported helper at
// module-eval time is fragile under Vite SSR (`flue run`). The fake client is
// built lazily on first use, when the module graph is fully initialized.
const FIXTURE_MODE = process.env.FIXTURE_MODE === 'true';
if (FIXTURE_MODE) {
  process.env.CF_API_TOKEN ||= 'fixture';
  process.env.CF_ACCOUNT_ID ||= 'fixture';
  // Presence of this token is what enables the Cloudforce One enrichment step.
  process.env.CLOUDFORCE_ONE_API_TOKEN ||= 'fixture';
}

/** Lazily build + memoize the offline fake, shared by both accessors. */
function fixtureClient(): Cloudflare {
  if (!testClient) testClient = buildFixtureCloudflareClient();
  return testClient;
}

export function getCloudflareClient(): Cloudflare {
  if (testClient) return testClient;
  if (FIXTURE_MODE) return fixtureClient();
  if (!defaultClient) {
    const { apiToken } = getCloudflareApiConfig();
    defaultClient = new Cloudflare({ apiToken });
  }
  return defaultClient;
}

// Cloudforce One carries its own (optional) token, distinct from CF_API_TOKEN.
export function getCloudforceOneClient(apiToken: string): Cloudflare {
  if (testClient) return testClient;
  if (FIXTURE_MODE) return fixtureClient();
  if (!cloudforceOneClient) {
    cloudforceOneClient = new Cloudflare({ apiToken });
  }
  return cloudforceOneClient;
}

export function __setCloudflareClientForTests(client: Cloudflare | undefined): void {
  testClient = client;
  defaultClient = undefined;
  cloudforceOneClient = undefined;
}

// Maps an SDK error to a short status note. A failed or unknown lookup must
// never be reported as clean, so callers attach the note to a
// "lookup_failed"/"no_match" result instead of throwing to the model.
export interface CfErrorNote {
  status?: number;
  notFound: boolean;
  note: string;
}

export function cfErrorNote(err: unknown): CfErrorNote {
  if (err instanceof APIError && typeof err.status === 'number') {
    const status = err.status;
    if (status === 404) return { status, notFound: true, note: 'no record found (404)' };
    if (status === 401 || status === 403) {
      return { status, notFound: false, note: `no read access (${status})` };
    }
    if (status === 429) return { status, notFound: false, note: 'rate limited (429)' };
    if (status >= 500) return { status, notFound: false, note: `upstream error (${status})` };
    return { status, notFound: false, note: `request failed (${status})` };
  }
  return { notFound: false, note: err instanceof Error ? err.message : String(err) };
}
