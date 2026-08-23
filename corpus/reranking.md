# Reranking

Vector retrieval is fast but coarse: it ranks by embedding similarity, which is
an approximation of relevance. A reranking pass re-scores the top candidates
with a more expensive, more accurate model before they reach the generator.

## Cross-encoders

A bi-encoder embeds the query and each document separately, which is what makes
vector search fast because documents can be embedded ahead of time. A
cross-encoder instead feeds the query and a candidate document together through
a model that attends across both, producing a far more accurate relevance score.
Cross-encoders are too slow to run over an entire corpus, so they are applied
only to the top candidates that vector search already surfaced. A typical
pipeline retrieves the top 50 by vector similarity and reranks them down to the
top 5.

## Maximal Marginal Relevance

Maximal Marginal Relevance (MMR) diversifies results. Instead of returning the
five most similar passages, which may be near-duplicates, MMR balances relevance
to the query against novelty relative to passages already selected. This is
useful when a corpus contains repetitive text, because it stops the context
window from filling with the same fact stated five ways.

## When reranking pays off

Reranking adds latency and, if a hosted reranker is used, cost. It pays off most
when the corpus is large and noisy, when queries are ambiguous, or when the
first-stage retriever returns many near-misses. For a small, clean corpus the
gain can be marginal, so reranking is best added once evaluation shows
first-stage retrieval leaving relevant passages just outside the top-k.
