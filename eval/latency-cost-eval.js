// Latency (p50/p95), refusal rate, and generation cost over the golden set,
// run through the full answerQuestion() pipeline (retrieve → rerank →
// generate), traced to Langfuse when LANGFUSE_* keys are set.
//
//   npm run eval:latency
//   GROQ_PRICE_IN_PER_M=0.xx GROQ_PRICE_OUT_PER_M=0.xx npm run eval:latency   (for a cost figure)
//
// Note: this measures generation-model tokens only (via generate.js's
// reported usage). Embedding tokens aren't included — OpenRouter's embeddings
// response isn't read for usage here, and embedding cost is typically a small
// fraction of generation cost for this workload.
import fs from 'node:fs';
import { answerQuestion } from '../src/reliability.js';
import { timed, report } from './instrumentation.js';
import { flushTraces } from '../src/tracing.js';

const golden = JSON.parse(fs.readFileSync('./eval/golden.json', 'utf8'));

const DELAY = Number(process.env.DOCMIND_EVAL_DELAY_MS) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function deriveMeta(result) {
  const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
  return {
    refused: result.status === 'no_coverage',
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    status: result.status,
  };
}

async function main() {
  for (const item of golden) {
    await timed(() => answerQuestion(item.question), deriveMeta);
    process.stdout.write('.');
    if (DELAY) await sleep(DELAY);
  }

  console.log('\n\n===== latency / refusal / cost =====');
  report();
  console.log('=====================================');
  await flushTraces();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
