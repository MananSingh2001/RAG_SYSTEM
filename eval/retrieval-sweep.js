// Retrieval-only diagnostic: finds the matchThreshold that maximises hit-rate,
// using ONLY embeddings (no generation or judge calls), so it is cheap and safe
// on a free tier. For each golden question it embeds once, pulls the top-10
// candidates at threshold 0, then scores hit-rate@5 and MRR at several
// thresholds by filtering locally.
//
//   npm run sweep
//
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { embedOne } from '../src/embeddings.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const golden = JSON.parse(fs.readFileSync('./eval/golden.json', 'utf8'));

const THRESHOLDS = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
const K = config.topK; // hit-rate@k, same k the app uses
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = Number(process.env.DOCMIND_EVAL_DELAY_MS) || 0;

async function main() {
  // 1. embed each question once and pull top-10 candidates (threshold 0)
  const perQuestion = [];
  for (const item of golden) {
    const emb = await embedOne(item.question);
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: emb,
      match_threshold: 0,
      match_count: 10,
    });
    if (error) throw new Error(`retrieval failed: ${error.message}`);
    perQuestion.push({ expected: item.expected_source, rows: data ?? [] });
    process.stdout.write('.');
    if (DELAY) await sleep(DELAY);
  }

  // 2. score hit-rate@K and MRR at each threshold by filtering locally
  console.log('\n\n===== retrieval threshold sweep =====');
  console.log(`questions: ${golden.length}   k: ${K}`);
  console.log('threshold | hit@k  | MRR   | avg#returned');
  console.log('----------|--------|-------|-------------');
  for (const t of THRESHOLDS) {
    let hits = 0;
    let rrSum = 0;
    let returnedSum = 0;
    for (const q of perQuestion) {
      const kept = q.rows.filter((r) => r.similarity > t).slice(0, K);
      returnedSum += kept.length;
      const rank = kept.findIndex((r) => r.source_name === q.expected);
      if (rank !== -1) {
        hits += 1;
        rrSum += 1 / (rank + 1);
      }
    }
    const n = golden.length;
    console.log(
      `${t.toFixed(2).padStart(9)} | ` +
        `${((hits / n) * 100).toFixed(1).padStart(5)}% | ` +
        `${(rrSum / n).toFixed(3)} | ` +
        `${(returnedSum / n).toFixed(1)}`
    );
  }
  console.log('=====================================');
  console.log(
    '\nPick the threshold with the best hit@k that still returns few enough'
  );
  console.log('chunks to stay grounded, then set matchThreshold in src/config.js.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
