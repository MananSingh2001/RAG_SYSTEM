# LLMOps and Observability

Running a retrieval system in production is an operations problem as much as a
modeling one. The failures that matter are rarely about the model being wrong;
they are about latency, cost, quota, and silent drift.

## Per-request logging

Every request should log its latency broken down by stage: embedding the query,
searching the index, and generating the answer. It should also log token counts
and an estimated cost per request. Without this breakdown, a slow system is a
mystery; with it, you can see immediately whether the bottleneck is retrieval or
generation.

## Cost control

Cost scales with tokens. The biggest levers are chunk size, which sets how many
tokens are embedded at ingestion, and top-k with context budget, which sets how
many tokens are sent to the generator per request. Caching embeddings for
repeated queries and caching answers for identical questions both cut cost
directly.

## Rate limits and backoff

Hosted APIs enforce rate limits, and free tiers enforce tight ones. A robust
client retries transient failures, such as HTTP 429 and 5xx responses, with
exponential backoff, waiting one second, then two, then four, then eight. Where
a provider supports failover, routing to a backup provider on repeated failure
keeps the system available.

## Continuous evaluation

The strongest operational discipline is running the evaluation automatically.
Wiring the eval into continuous integration so it runs on every change catches
retrieval and faithfulness regressions before they ship. Because a full eval
consumes API quota, teams on tight budgets often run the cheap deterministic
retrieval metrics on every commit and reserve the expensive LLM-as-judge pass
for a manual or scheduled run.

## Monitoring drift

Retrieval quality can decay silently: an index rebuilt with a different
embedding model, a corpus that grew stale, or a provider that quietly changed a
model behind an alias. Monitoring the rate of "no coverage" responses and
periodically re-running the golden set are cheap ways to detect drift early.
