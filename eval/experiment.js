// Chunk-size experiment: for each chunk size, wipe the corpus, re-ingest at
// that size, run the full eval, and print a side-by-side comparison so the
// README's "512 vs 256" row is backed by measurement, not a guess.
//
//   npm run experiment            # compares 256 and 512 (defaults)
//   npm run experiment -- 128 256 512
//
// Free-tier note: this runs the eval once per size (each = 15 gen + 15 judge
// LLM calls). On Groq's free tier (~6k tokens/min) you may hit 429s. If so,
// set a delay between questions:  DOCMIND_EVAL_DELAY_MS=1500 npm run experiment

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { ingestDir } from '../src/ingest.js';
import { retrieve } from '../src/retrieve.js';
import { generate } from '../src/generate.js';
import { judge } from './judge.js';
import { hitRate, mrr, keywordRecall } from './metrics.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);
const golden = JSON.parse(fs.readFileSync('./eval/golden.json', 'utf8'));

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = Number(process.env.DOCMIND_EVAL_DELAY_MS) || 0;

// delete all rows; documents cascade-delete their chunks, but we clear both
// explicitly so a partial run can't leave orphans. Supabase requires a filter
// on delete, so we match "id is not a null uuid" (always true).
async function wipeCorpus() {
  const NEVER = '00000000-0000-0000-0000-000000000000';
  const c = await supabase.from('chunks').delete().neq('id', NEVER);
  if (c.error) throw new Error(`wipe chunks failed: ${c.error.message}`);
  const d = await supabase.from('documents').delete().neq('id', NEVER);
  if (d.error) throw new Error(`wipe documents failed: ${d.error.message}`);
}

async function runEval() {
  const results = [];
  const faith = [];
  const rel = [];

  for (const item of golden) {
    const retrieved = await retrieve(item.question);
    let answer = '';

    if (retrieved.length > 0) {
      const capped = retrieved.slice(0, config.maxContextChunks);
      const context = capped
        .map((c, i) => `[${i + 1}] ${c.content}`)
        .join('\n\n');
      const gen = await generate(item.question, capped);
      answer = gen.answer;
      const verdict = await judge({ question: item.question, answer, context });
      faith.push(Number(verdict.faithfulness) || 0);
      rel.push(Number(verdict.relevance) || 0);
    }

    results.push({ ...item, retrieved, answer });
    process.stdout.write('.');
    if (DELAY) await sleep(DELAY);
  }

  return {
    hit: hitRate(results),
    mrr: mrr(results),
    kw: keywordRecall(results),
    faith: avg(faith),
    rel: avg(rel),
  };
}

async function main() {
  const sizes = process.argv.slice(2).map(Number).filter(Boolean);
  const chunkSizes = sizes.length ? sizes : [256, 512];

  const rows = [];
  for (const size of chunkSizes) {
    config.chunkSize = size; // read live by chunkDocument on each call
    console.log(`\n=== chunkSize=${size} tokens : wipe + re-ingest ===`);
    await wipeCorpus();
    const { files, chunks } = await ingestDir('./corpus');
    console.log(`ingested ${files} files -> ${chunks} chunks`);
    process.stdout.write('evaluating ');
    const m = await runEval();
    rows.push({ size, chunks, ...m });
  }

  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  console.log('\n\n===== chunk-size experiment =====');
  console.log('size | chunks | hit@k  | MRR   | keyword | faith | rel');
  console.log('-----|--------|--------|-------|---------|-------|-----');
  for (const r of rows) {
    console.log(
      `${String(r.size).padEnd(4)} | ` +
        `${String(r.chunks).padStart(6)} | ` +
        `${pct(r.hit).padStart(6)} | ` +
        `${r.mrr.toFixed(3)} | ` +
        `${pct(r.kw).padStart(7)} | ` +
        `${r.faith.toFixed(2)}  | ${r.rel.toFixed(2)}`
    );
  }
  console.log('=================================');

  if (rows.length >= 2) {
    const [a, b] = rows;
    const d = (x, y) => ((y - x) * 100).toFixed(1);
    console.log(
      `\ndelta (${b.size} - ${a.size}): ` +
        `hit@k ${d(a.hit, b.hit)} pts, ` +
        `keyword ${d(a.kw, b.kw)} pts, ` +
        `MRR ${(b.mrr - a.mrr).toFixed(3)}`
    );
  }

  console.log('\nNote: re-ingest leaves the corpus at the LAST size tested.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
