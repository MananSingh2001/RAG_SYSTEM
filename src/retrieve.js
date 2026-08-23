import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { embedOne } from './embeddings.js';

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export async function retrieve(
  question,
  { topK = config.topK, threshold = config.matchThreshold } = {}
) {
  const queryEmbedding = await embedOne(question);

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });
  if (error) throw new Error(`retrieval failed: ${error.message}`);

  // data: [{ id, source_name, chunk_index, content, similarity }]
  return data ?? [];
}
