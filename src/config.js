import 'dotenv/config';

export const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,

  // --- embeddings via OpenRouter (OpenAI-compatible) ---
  openrouterKey: process.env.OPENROUTER_API_KEY,
  openrouterBase: 'https://openrouter.ai/api/v1',
  embedModel: 'openai/text-embedding-3-small', // 1536-dim
  embedDim: 1536,

  // --- generation + judge via Groq (OpenAI-compatible) ---
  groqKey: process.env.GROQ_API_KEY,
  groqBase: 'https://api.groq.com/openai/v1',
  genModel: 'openai/gpt-oss-20b', // llama-3.3-70b-versatile was deprecated for free tier (Jun 2026)
  judgeModel: 'openai/gpt-oss-20b',

  // chunking
  chunkSize: 512, // approx tokens (char-approx in chunk.js)
  chunkOverlap: 64, // overlap keeps sentences from being cut mid-thought

  // retrieval
  topK: 5, // how many chunks to feed the model
  matchThreshold: 0.2, // tuned via `npm run sweep`: best hit-rate@5 with tight context (0.35 starved retrieval to <1 chunk/query)

  // generation
  maxContextChunks: 8, // hard cap so a big retrieval can't blow the window

  // assistant mode: when the corpus has no coverage, answer from general model
  // knowledge (clearly labelled "not from the corpus") instead of refusing, and
  // handle small talk + minor tasks. Set DOCMIND_ASSISTANT_MODE=false for the
  // strict grounded-only behaviour. Default: on.
  assistantMode: (process.env.DOCMIND_ASSISTANT_MODE ?? 'true') !== 'false',
};

for (const [k, v] of Object.entries(config)) {
  if (v === undefined) throw new Error(`Missing config/env value: ${k}`);
}
