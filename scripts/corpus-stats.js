// Read-only corpus size check: documents/chunks currently ingested in Supabase.
//   npm run corpus:stats
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

async function main() {
  // Note: `head: true` (no body) doesn't return a Content-Range count header
  // on this project/pooler config, so we select `id` and read `count` from
  // the normal response instead.
  const { count: docs, error: docErr } = await supabase
    .from('documents')
    .select('id', { count: 'exact' });
  if (docErr) throw new Error(`documents count failed: ${docErr.message}`);

  const { count: chunks, error: chunkErr } = await supabase
    .from('chunks')
    .select('id', { count: 'exact' });
  if (chunkErr) throw new Error(`chunks count failed: ${chunkErr.message}`);

  console.log(JSON.stringify({ documents: docs, chunks }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
