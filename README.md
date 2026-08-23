# sourcebound — Grounded RAG Assistant with Evaluation

> Answers questions strictly from a document corpus, with inline citations, a
> reproducible evaluation harness, and a reliability layer that handles the
> failure modes real RAG systems hit.

**Live demo:** https://sourcebound-one.vercel.app · **CI:** syntax check on every push; full eval on demand.

<!-- Add a UI screenshot or GIF here once deployed, e.g. ![sourcebound UI](docs/screenshot.png) -->

## What it does

sourcebound ingests a folder of Markdown/text documents, embeds them into pgvector,
and answers questions **only** from what it retrieves — every answer carries
inline citations back to the source file and chunk. When retrieval finds nothing
above the similarity threshold, it refuses honestly instead of guessing. A small
intent layer handles greetings and "what can you do" conversationally, so casual
input gets a friendly reply while substantive questions go through grounded RAG.

## Architecture

```
Ingestion (once per doc):  read → chunk (overlap) → embed → store (pgvector)
Query (every question):    embed → vector search (top-k) → cited context → Groq LLM → answer
```

Providers are OpenAI-compatible: **OpenRouter** for embeddings, **Groq** for
generation and the LLM-judge. One SDK, only the base URL and key change.

## Results / Evaluation

Corpus: **14 documents → 18 chunks** (chunkSize 512), evaluated against a
**37-pair golden set** spanning every document.

### Retrieval — before vs after reranking

Retrieval quality on the clean corpus, measured with `npm run eval:rerank`
(embeddings + Cohere only, no LLM cost):

| | hit-rate@5 | MRR |
|---|---|---|
| Vector only | 91.9% | 0.731 |
| **+ Cohere reranker (`rerank-v3.5`)** | **100%** | **0.941** |

The reranker pulls a 20-candidate pool from pgvector and reorders it with a
cross-encoder, lifting MRR from 0.731 → 0.941 — it fixes the cases where the right
document was retrieved but ranked 2nd or 3rd under pure vector similarity. Set
`COHERE_API_KEY` to enable it; absent the key it falls back to vector order with no
behaviour change. (This is a 37-pair set on a small corpus, so 100% shows the
reranker cleanly resolves ordering here, not that it holds at arbitrary scale.)

Run config: embeddings `openai/text-embedding-3-small` (1536-dim, via OpenRouter),
generation + judge `openai/gpt-oss-20b` (via Groq), `matchThreshold` 0.20 (tuned
with `npm run sweep`), `topK` 5, rerank candidate pool 20.

### Generation quality (LLM-as-judge)

Faithfulness and answer-relevance are scored by a separate Groq instance over the
golden set via `npm run eval`. Re-run it to populate these on your setup — a prior
run scored faithfulness ~4.8/5. (Groq's free tier is capped at 200k tokens/day, so
a full 37-question judge run may need to wait for the daily reset.)

The **chunk-size experiment** (`npm run experiment`) re-ingests and re-evals at 256
vs 512 and prints the delta.

> Reproducibility note: `ingest.js` appends, so re-ingesting without first running
> `truncate chunks, documents;` leaves duplicate chunks that quietly degrade
> retrieval. All numbers above are on a clean, de-duplicated 18-chunk corpus.

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

- **Hybrid search** (keyword + vector) for exact-term queries the embedding misses.
- **Eval in CI** — already scaffolded in `.github/workflows/ci.yml` (syntax on every
  push; full LLM eval on demand to respect free-tier quota).
- Streaming responses and per-request cost/latency logging.

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
npm run eval           # scorecard against eval/golden.json
npm run experiment     # re-ingests + re-evals at 256 vs 512 and prints the delta
```

### 6b. Scale the corpus (optional)

```bash
npm run corpus:build -- 200   # fetch ~200 real Wikipedia articles → ./corpus-large
npm run ingest -- ./corpus-large
```

Pulls real public text (Wikipedia REST API, no key) to demonstrate scale. Kept
separate from `./corpus` (which the eval targets). Stays well under Supabase's
free 500MB cap — ~200 articles ≈ 1–2k chunks ≈ ~15MB. Millions of rows would
need a paid database and an embedding budget; this shows the pipeline scaling
within the free tier.

### 7. Frontend (optional)

```bash
cd client
npm install
npm run dev        # http://localhost:5173, proxies /ask to :8080
```

## Project layout

```
sourcebound/
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
