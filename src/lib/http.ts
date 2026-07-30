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

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new HttpTimeoutError(url, timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// One bounded retry on network errors, timeouts, and 5xx/429 — never on 4xx
// (deterministic). For read-only (idempotent) calls only.
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
      if (attempt === retries) return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
}
