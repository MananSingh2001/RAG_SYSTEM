// Shared exponential-backoff retry for transient API failures (429/5xx/network).
// embeddings.js has its own copy for provider-fallback reasons; generation and
// the judge use this so a free-tier rate limit (429) slows the eval down instead
// of crashing it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withBackoff(fn, { retries = 6, label = 'request' } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? 0;
      const transient =
        status === 429 || status === 529 || status >= 500 || status === 0;
      if (!transient || attempt >= retries) throw err;
      // 1s, 2s, 4s, 8s, 16s, 16s — enough to clear a per-minute token window
      const wait = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(`${label} retry ${attempt + 1} in ${wait}ms (status ${status})`);
      await sleep(wait);
      attempt++;
    }
  }
}
