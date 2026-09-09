// Optional Langfuse tracing of the query pipeline (retrieve → rerank →
// generate). Enabled automatically when LANGFUSE_PUBLIC_KEY and
// LANGFUSE_SECRET_KEY are both set; absent them, every export below is a
// no-op — same fallback pattern as the Cohere reranker (config.rerankEnabled).
import { Langfuse } from 'langfuse';
import { config } from './config.js';

const client = config.langfuseEnabled
  ? new Langfuse({
      publicKey: config.langfusePublicKey,
      secretKey: config.langfuseSecretKey,
      baseUrl: config.langfuseHost,
    })
  : null;

// One trace per question.
export function startTrace(name, input) {
  return client ? client.trace({ name, input }) : null;
}

// Wrap one pipeline stage as a child span. No-op passthrough when tracing is off.
export async function withSpan(trace, name, fn, input) {
  if (!trace) return fn();
  const span = trace.span({ name, input });
  try {
    const output = await fn();
    span.end({ output });
    return output;
  } catch (err) {
    span.end({ output: { error: err.message }, level: 'ERROR' });
    throw err;
  }
}

export function endTrace(trace, output) {
  if (trace) trace.update({ output });
}

// Call once at process exit (or after a batch eval run) to make sure queued
// events reach Langfuse before the process ends.
export async function flushTraces() {
  if (client) await client.flushAsync();
}
