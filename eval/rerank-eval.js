// Retrieval-only before/after reranking comparison — measures hit-rate@k and MRR
// with plain vector order vs after the Cohere reranker. Uses ONLY embeddings +
// Cohere (no Groq generation/judge), so it sidesteps Groq's daily token cap and
// isolates exactly what reranking changes: ordering.
//
//   npm run eval:rerank      (needs COHERE_API_KEY set)
//
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { embedOne } from '../src/embeddings.js';
import { rerankChunks } from '../src/rerank.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const golden = JSON.parse(fs.readFileSync('./eval/golden.json', 'utf8'));
const K = config.topK;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const hit = (rows, expected) =>
  rows.slice(0, K).some((r) => r.source_name === expected) ? 1 : 0;
const rr = (rows, expected) => {
  const i = rows.slice(0, K).findIndex((r) => r.source_name === expected);
  return i === -1 ? 0 : 1 / (i + 1);
};

async function main() {
  if (!config.rerankEnabled) {
    console.error('COHERE_API_KEY not set — nothing to compare. Set it and retry.');
    process.exit(1);
  }

  let baseHit = 0, baseMrr = 0, rrHit = 0, rrMrr = 0;

  for (const item of golden) {
    const emb = await embedOne(item.question);
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: emb,
      match_threshold: config.matchThreshold,
      match_count: config.candidateCount,
    });
    if (error) throw new Error(`retrieval failed: ${error.message}`);
    const candidates = data ?? [];

    // baseline: vector order
    baseHit += hit(candidates, item.expected_source);
    baseMrr += rr(candidates, item.expected_source);

    // reranked
    const ranked = await rerankChunks(item.question, candidates, K);
    rrHit += hit(ranked, item.expected_source);
    rrMrr += rr(ranked, item.expected_source);

    process.stdout.write('.');
    await sleep(6500); // Cohere free tier: 10 rerank calls/min
  }

  const n = golden.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;
  console.log('\n\n===== reranking: before vs after =====');
  console.log(`questions: ${n}   k: ${K}   candidates: ${config.candidateCount}`);
  console.log('                 hit@k   MRR');
  console.log(`vector only:     ${pct(baseHit).padStart(5)}   ${(baseMrr / n).toFixed(3)}`);
  console.log(`+ reranker:      ${pct(rrHit).padStart(5)}   ${(rrMrr / n).toFixed(3)}`);
  console.log('======================================');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
