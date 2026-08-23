# docmind — Grounded RAG Assistant with Evaluation

> Answers questions strictly from a document corpus, with inline citations, a
> reproducible evaluation harness, and a reliability layer that handles the
> failure modes real RAG systems hit.

## What it does

docmind ingests a folder of Markdown/text documents, embeds them into pgvector,
and answers questions **only** from what it retrieves — every answer carries
inline citations back to the source file and chunk. When retrieval finds nothing
above the similarity threshold, it refuses honestly instead of guessing.

## Architecture

```
Ingestion (once per doc):  read → chunk (overlap) → embed → store (pgvector)
Query (every question):    embed → vector search (top-k) → cited context → Groq LLM → answer
```

Providers are OpenAI-compatible: **OpenRouter** for embeddings, **Groq** for
generation and the LLM-judge. One SDK, only the base URL and key change.

## Results / Evaluation

Measured on the sample corpus with `npm run eval` (reproduce with the same command):

| Metric | Score | Notes |
|---|---|---|
| Retrieval hit-rate@5 | 73.3% | over 15 hand-written Q&A pairs (expand to 30–50) |
| MRR | 0.700 | |
| Keyword recall | 73.3% | deterministic; expected terms present in the answer |
| Answer faithfulness (LLM-judge) | 5.00 / 5 | separate Groq instance as judge |
| Answer relevance (LLM-judge) | 4.92 / 5 | |
| Chunk-size experiment | 512 vs 256 | re-run eval at each `chunkSize` and record the delta |

Run config: embeddings `openai/text-embedding-3-small` (1536-dim, via OpenRouter),
generation + judge `openai/gpt-oss-20b` (via Groq), `matchThreshold` 0.35, `topK` 5.
The sample corpus is small (4 docs → 4 chunks), so hit-rate/MRR here mostly reflect
whether each query clears the similarity floor; the ~27% miss is queries falling just
under threshold. Grow the corpus or lower `chunkSize` to make these metrics meaningful.

Reproduce: `npm run eval`.

## Reliability — failure modes handled

| Failure mode | Behaviour |
|---|---|
| Retrieval below similarity threshold | Refuses; states corpus has no coverage |
| Embedding API timeout / 5xx / 529 | Retry w/ backoff + OpenRouter provider fallback |
| Oversized retrieval | Context-budget cap before the model call |
| Empty / malformed output | Validated; safe fallback |

## Engineering decisions & tradeoffs

- **pgvector over Pinecone:** single DB, ACID, no extra infra at this scale.
- **HNSW over IVFFlat:** better recall for < 1M rows; one-time build cost.
- **OpenRouter (embeddings) + Groq (generation):** both OpenAI-compatible, so
  one SDK, provider-agnostic code, and easy model swaps for A/B testing.
- **Chunk size:** default 512-token windows with 64 overlap — tune with the eval.

## What I'd improve for production

- Hybrid search (keyword + vector) for exact-term queries
- Re-ranking pass before context assembly
- Run eval in CI on every commit
- Streaming responses and per-request cost/latency logging

## Run it locally

### 1. Install

```bash
npm install
cp .env.example .env    # then fill in your keys
```

### 2. Provision the database

Open the Supabase SQL editor and run `sql/schema.sql`.

### 3. Verify model IDs (they drift)

```bash
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

Pick a current instruct model and update `genModel` / `judgeModel` in
`src/config.js` if needed.

### 4. Ingest the sample corpus

```bash
npm run ingest -- ./corpus
```

### 5. Serve and ask

```bash
npm run serve
curl -X POST localhost:8080/ask \
  -H "content-type: application/json" \
  -d '{"question":"What similarity metric does the retriever use?"}'
```

### 6. Evaluate

```bash
npm run eval
```

### 7. Frontend (optional)

```bash
cd client
npm install
npm run dev        # http://localhost:5173, proxies /ask to :8080
```

## Project layout

```
docmind/
├─ sql/schema.sql          pgvector, tables, HNSW index, match_chunks RPC
├─ src/
│  ├─ config.js            env + tunables (chunk size, top-k, thresholds)
│  ├─ embeddings.js        embed one/many texts (retry + backoff)
│  ├─ chunk.js             overlapping char-based splitter
│  ├─ ingest.js            CLI: read → chunk → embed → store
│  ├─ retrieve.js          embed query → vector search → top-k chunks
│  ├─ generate.js          cited context → Groq LLM → grounded answer
│  ├─ reliability.js       threshold refusal, context cap, output validation
│  └─ server.js            Express API (/ingest, /ask, /health)
├─ eval/
│  ├─ golden.json          hand-written Q&A + expected source
│  ├─ metrics.js           hit-rate@k, MRR, keyword recall (deterministic)
│  ├─ judge.js             LLM-as-judge faithfulness + relevance
│  └─ run.js               runs the full eval → prints scorecard
├─ corpus/                 sample documents to ingest
└─ client/                 React/Vite UI
```

## Security notes

The Supabase **service-role key** bypasses row-level security and is used
server-side only — it must never reach the browser. `.env` is gitignored; keep
it that way.
