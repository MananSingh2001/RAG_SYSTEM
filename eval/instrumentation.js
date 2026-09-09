// Latency / refusal / cost instrumentation for eval runs.
//
// Cost is priced from env vars (USD per 1M tokens) — never hardcoded, since
// provider prices change and we don't fabricate numbers. If a price isn't
// set, cost is reported as null (not a guessed figure).
//   GROQ_PRICE_IN_PER_M / GROQ_PRICE_OUT_PER_M   (generation + judge model)
const LOG = [];

export function record({ latencySec, refused, inputTokens = 0, outputTokens = 0, status }) {
  LOG.push({ latencySec, refused: !!refused, inputTokens, outputTokens, status });
}

// Runs fn(), times it, and records one log entry. `deriveMeta(output)` maps
// the resolved output to { refused, inputTokens, outputTokens, status } —
// keeps the timing and the outcome bookkeeping as a single atomic record.
export async function timed(fn, deriveMeta = () => ({})) {
  const t0 = performance.now();
  const out = await fn();
  const latencySec = (performance.now() - t0) / 1000;
  record({ latencySec, ...deriveMeta(out) });
  return out;
}

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

export function report() {
  if (LOG.length === 0) {
    console.log('No queries recorded.');
    return null;
  }
  const lat = [...LOG.map((r) => r.latencySec)].sort((a, b) => a - b);
  const median = percentile(lat, 50);
  const p95 = percentile(lat, 95);
  const refusalRate = LOG.filter((r) => r.refused).length / LOG.length;

  const priceIn = Number(process.env.GROQ_PRICE_IN_PER_M);
  const priceOut = Number(process.env.GROQ_PRICE_OUT_PER_M);
  const pricingSet = Number.isFinite(priceIn) && Number.isFinite(priceOut);

  const totalInTok = LOG.reduce((s, r) => s + r.inputTokens, 0);
  const totalOutTok = LOG.reduce((s, r) => s + r.outputTokens, 0);
  const costUsd = pricingSet
    ? (totalInTok * priceIn + totalOutTok * priceOut) / 1_000_000
    : null;

  const summary = {
    n: LOG.length,
    p50_latency_s: Number(median.toFixed(3)),
    p95_latency_s: Number(p95.toFixed(3)),
    refusal_rate: Number(refusalRate.toFixed(3)),
    total_input_tokens: totalInTok,
    total_output_tokens: totalOutTok,
    cost_per_1k_queries_usd: costUsd === null
      ? null
      : Number(((costUsd / LOG.length) * 1000).toFixed(4)),
    pricing_source: pricingSet
      ? 'GROQ_PRICE_IN_PER_M / GROQ_PRICE_OUT_PER_M env vars'
      : 'not set — set GROQ_PRICE_IN_PER_M / GROQ_PRICE_OUT_PER_M (USD per 1M tokens) for a cost figure',
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

export function reset() {
  LOG.length = 0;
}
