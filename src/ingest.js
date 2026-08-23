import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { chunkDocument } from './chunk.js';
import { embedTexts } from './embeddings.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function ingestFile(filePath) {
  const sourceName = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const chunks = chunkDocument(raw);

  if (chunks.length === 0) {
    console.warn(`skip (empty): ${sourceName}`);
    return 0;
  }

  // 1. create the document row
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({ source_name: sourceName })
    .select()
    .single();
  if (docErr) throw docErr;

  // 2. embed all chunks (batched inside embedTexts)
  const embeddings = await embedTexts(chunks);

  // 3. insert chunk rows with provenance
  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    source_name: sourceName,
    chunk_index: i,
    content,
    embedding: embeddings[i],
  }));
  const { error: chunkErr } = await supabase.from('chunks').insert(rows);
  if (chunkErr) throw chunkErr;

  console.log(`ingested ${sourceName}: ${rows.length} chunks`);
  return rows.length;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: npm run ingest -- <folder>');
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .map((f) => path.join(dir, f));

  let total = 0;
  for (const f of files) total += await ingestFile(f);
  console.log(`\nDONE. ${files.length} files, ${total} chunks total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
