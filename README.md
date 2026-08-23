# sourcebound — Grounded RAG Assistant with Evaluation

> Answers questions strictly from a document corpus, with inline citations, a
> reproducible evaluation harness, and a reliability layer that handles the
> failure modes real RAG systems hit.

**Live demo:** _(add your Vercel URL here after deploying)_ · **CI:** syntax check on every push; full eval on demand.

<!-- Add a UI screenshot or GIF here once deployed, e.g. ![sourcebound UI](docs/screenshot.png) -->

## What it does

sourcebound ingests a folder of Markdown/text documents, embeds them into pgvector,
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

Corpus: **14 documents → 18 chunks** (chunkSize 512), evaluated against a
**37-pair golden set** spanning every document. Reproduce with `npm run eval`.

| Metric | Score | Notes |
|---|---|---|
| Retrieval hit-rate@5 | 40.5% | expected source in the top-5 retrieved chunks |
| MRR | 0.378 | rank of the first correct source |
| Keyword recall | 51.4% | expected terms present in the answer (deterministic) |
| Answer faithfulness (LLM-judge) | 4.78 / 5 | answer supported by the retrieved context |
| Answer relevance (LLM-judge) | 4.00 / 5 | answer addresses the question |

Run config: embeddings `openai/text-embedding-3-small` (1536-dim, via OpenRouter),
generation + judge `openai/gpt-oss-20b` (via Groq), `matchThreshold` 0.20, `topK` 5.

### Tuning the threshold by measurement

`npm run sweep` scores retrieval (embeddings only, no LLM cost) across thresholds.
The default was starving retrieval — at 0.35 it returned under one chunk per query:

| matchThreshold | hit-rate@5 | MRR | avg chunks returned |
|---|---|---|---|
| 0.15 | 40.5% | 0.378 | 3.6 |
| **0.20** | **40.5%** | **0.378** | **2.8** |
| 0.25 | 37.8% | 0.351 | 2.2 |
| 0.30 | 35.1% | 0.338 | 1.2 |
| 0.35 | 29.7% | 0.284 | 0.8 |
| 0.40 | 21.6% | 0.216 | 0.3 |

0.20 gives the best hit-rate with the tightest context, so it is the configured
default. Generation is strong (faithfulness 4.78) — the bottleneck is **retrieval**:
hit-rate plateaus near 40% because the corpus is topically dense (14 documents on
adjacent RAG concepts), so the correct chunk competes with near-identical ones that
pure vector similarity can't always rank first. This is the measured case for the
reranking / hybrid-search work listed below.

The **chunk-size experiment** (`npm run experiment`) re-ingests and re-evals at 256
vs 512 and prints the delta.

> An earlier 4-doc corpus scored 73.3% hit-rate — but with one chunk per document
> that wasn't testing retrieval. The expanded corpus makes these numbers real.

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

- **Re-ranking pass** before context assembly — the measured next lever: the
  threshold sweep shows retrieval plateauing near 40% hit-rate on a topically
  dense corpus, exactly where a cross-encoder reranker helps most.
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
