/**
 * Small fetch helpers shared by every outbound call in the agent.
 *
 * Two concerns, both important for a Worker that talks to third-party APIs
 * under a bounded CPU/wall-clock budget:
 *   1. Timeouts   — a hung upstream must not stall the whole investigation.
 *   2. Retries    — transient network / 5xx blips on read-only calls should
 *                   not fail an investigation on the first hiccup.
 */

export class HttpTimeoutError extends Error {
  constructor(
    public readonly url: string,
    public readonly timeoutMs: number,
  ) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'HttpTimeoutError';
  }
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * fetch() with a hard timeout enforced via AbortController. Throws
 * HttpTimeoutError on timeout so callers can distinguish it from other
 * network errors.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new HttpTimeoutError(url, timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a fetch-returning function with one bounded retry. Retries on network
 * errors, timeouts, and 5xx / 429 responses — never on 4xx (those are
 * deterministic and a retry only wastes budget). Intended for read-only
 * (idempotent) calls only.
 */
export async function fetchWithRetry(
  makeRequest: () => Promise<Response>,
  { retries = 1, backoffMs = 300 }: { retries?: number; backoffMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await makeRequest();
      if (res.status < 500 && res.status !== 429) return res;
      lastError = new Error(`upstream responded ${res.status}`);
      if (attempt === retries) return res; // out of retries — hand back the response
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
  }
  // Unreachable, but keeps the type checker honest.
  throw lastError instanceof Error ? lastError : new Error('request failed');
}
