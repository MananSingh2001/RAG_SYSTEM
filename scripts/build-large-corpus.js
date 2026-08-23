// Build a larger, REAL corpus from Wikipedia to demonstrate scale — free, no
// API key. Writes plain-text articles to ./corpus-large as .md files, which you
// then embed with the normal pipeline:
//
//   node scripts/build-large-corpus.js 200      # ~200 random articles
//   npm run ingest -- ./corpus-large            # embed + store in Supabase
//
// Uses the MediaWiki action API's random generator to fetch a BATCH of articles
// (with extracts) per request — far fewer calls than one-random-at-a-time, so it
// avoids the 429 rate limiting. Stays well under Supabase's free 500MB cap:
// ~200 articles ≈ 1–2k chunks ≈ ~15MB.
//
// Note: SCALE demo corpus, kept separate from ./corpus (which the eval targets).
// Wikipedia text is CC BY-SA; for a personal demo, not redistribution.

import fs from 'node:fs';
import path from 'node:path';

const COUNT = Number(process.argv[2]) || 200;
const OUT = path.resolve('./corpus-large');
const BATCH = 20; // exlimit max for extracts
const UA = 'sourcebound-demo/0.1 (personal portfolio; contact via github)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function fetchBatch() {
  const url =
    'https://en.wikipedia.org/w/api.php?format=json&origin=*' +
    '&action=query&generator=random&grnnamespace=0&grnlimit=' +
    BATCH +
    '&prop=extracts&explaintext=1&exlimit=max';

  // retry with backoff on 429 / transient errors
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'Api-User-Agent': UA, 'User-Agent': UA } });
    if (res.ok) return Object.values((await res.json())?.query?.pages ?? {});
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.min(1000 * 2 ** attempt, 16000);
      console.warn(`  rate-limited (${res.status}); waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`wikipedia ${res.status}`);
  }
  throw new Error('giving up after repeated rate limits');
}

async function main() {
  console.log(`Fetching ~${COUNT} Wikipedia articles into ${OUT} ...`);
  const seen = new Set();
  let written = 0;

  while (written < COUNT) {
    const pages = await fetchBatch();
    for (const p of pages) {
      const title = p?.title;
      const extract = p?.extract ?? '';
      if (!title || seen.has(title) || extract.length < 600) continue; // skip stubs
      seen.add(title);
      fs.writeFileSync(
        path.join(OUT, `${slug(title)}.md`),
        `# ${title}\n\n${extract.trim()}\n`,
        'utf8'
      );
      written++;
      if (written >= COUNT) break;
    }
    console.log(`  ${written}/${COUNT}`);
    await sleep(1000); // polite pause between batches
  }

  console.log(`\nDONE. Wrote ${written} articles to ${OUT}.`);
  console.log('Next: npm run ingest -- ./corpus-large');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
