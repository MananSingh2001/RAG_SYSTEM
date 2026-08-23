// Build a larger, REAL corpus from Wikipedia to demonstrate scale — free, no
// API key. Writes plain-text articles to ./corpus-large as .md files, which you
// then embed with the normal pipeline:
//
//   node scripts/build-large-corpus.js 200      # ~200 random articles
//   npm run ingest -- ./corpus-large            # embed + store in Supabase
//
// Stays well under Supabase's free 500MB cap: ~200 articles ≈ 1–2k chunks ≈
// ~15MB. Raise the count as you like, but keep it in the low thousands on free.
//
// Note: this is a SCALE demo corpus, kept separate from ./corpus (which the
// eval's golden set targets). Wikipedia text is CC BY-SA; this is for a personal
// demo, not redistribution.

import fs from 'node:fs';
import path from 'node:path';

const COUNT = Number(process.argv[2]) || 200;
const OUT = path.resolve('./corpus-large');
const UA = 'sourcebound-demo/0.1 (personal portfolio project)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

async function randomTitle() {
  const res = await fetch(
    'https://en.wikipedia.org/api/rest_v1/page/random/summary',
    { headers: { 'User-Agent': UA, accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`random summary ${res.status}`);
  const j = await res.json();
  return j.title;
}

async function plainExtract(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?format=json&action=query' +
    '&prop=extracts&explaintext=1&redirects=1&origin=*&titles=' +
    encodeURIComponent(title);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`extract ${res.status}`);
  const j = await res.json();
  const pages = j?.query?.pages ?? {};
  const first = Object.values(pages)[0];
  return { title: first?.title ?? title, extract: first?.extract ?? '' };
}

async function main() {
  console.log(`Fetching ~${COUNT} Wikipedia articles into ${OUT} ...`);
  const seen = new Set();
  let written = 0;
  let attempts = 0;

  while (written < COUNT && attempts < COUNT * 3) {
    attempts++;
    try {
      const title = await randomTitle();
      if (!title || seen.has(title)) continue;
      seen.add(title);

      const { title: t, extract } = await plainExtract(title);
      // skip stubs — too short to produce a useful chunk
      if (!extract || extract.length < 600) continue;

      const body = `# ${t}\n\n${extract.trim()}\n`;
      fs.writeFileSync(path.join(OUT, `${slug(t)}.md`), body, 'utf8');
      written++;
      if (written % 20 === 0) console.log(`  ${written}/${COUNT}`);
      await sleep(200); // be polite to the API
    } catch (err) {
      console.warn(`  skip (${err.message})`);
      await sleep(500);
    }
  }

  console.log(`\nDONE. Wrote ${written} articles to ${OUT}.`);
  console.log('Next: npm run ingest -- ./corpus-large');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
