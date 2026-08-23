import fs from 'node:fs';
import { config } from '../src/config.js';
import { retrieve } from '../src/retrieve.js';
import { generate } from '../src/generate.js';
import { judge } from './judge.js';
import { hitRate, mrr, keywordRecall } from './metrics.js';

const golden = JSON.parse(fs.readFileSync('./eval/golden.json', 'utf8'));
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

// Optional pause between questions to stay under free-tier token/min limits.
// e.g. DOCMIND_EVAL_DELAY_MS=4000 npm run eval
const DELAY = Number(process.env.DOCMIND_EVAL_DELAY_MS) || 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const results = [];
  const faith = [];
  const rel = [];

  for (const item of golden) {
    const retrieved = await retrieve(item.question);
    let answer = '';
    let context = '';

    if (retrieved.length > 0) {
      const capped = retrieved.slice(0, config.maxContextChunks);
      context = capped.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
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

  console.log('\n\n===== sourcebound eval scorecard =====');
  console.log(`questions:            ${golden.length}`);
  console.log(
    `retrieval hit-rate@${config.topK}:  ${(hitRate(results) * 100).toFixed(1)}%`
  );
  console.log(`MRR:                  ${mrr(results).toFixed(3)}`);
  console.log(
    `keyword recall:       ${(keywordRecall(results) * 100).toFixed(1)}%`
  );
  console.log(`faithfulness (judge): ${avg(faith).toFixed(2)} / 5`);
  console.log(`relevance   (judge):  ${avg(rel).toFixed(2)} / 5`);
  console.log('==================================');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
