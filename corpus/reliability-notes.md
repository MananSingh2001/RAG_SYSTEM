# Reliability Notes

The reliability layer wraps retrieval and generation and enforces four
behaviours that separate a demo from a system.

First, a coverage guard: when no chunk clears the cosine similarity threshold,
the system refuses honestly and states that the corpus has no coverage for the
question rather than guessing. This "no coverage" path is treated as a valid,
honest answer.

Second, transient-failure handling: the embeddings module retries on 429, 529,
and 5xx responses with exponential backoff (1s, 2s, 4s, 8s), and OpenRouter can
fail over to a backup provider.

Third, a context-budget cap: retrieval is truncated to `maxContextChunks`
before the model call so a large retrieval can never blow the context window.

Fourth, output validation: an empty or malformed model response is caught and
replaced with a safe fallback message instead of being returned to the user.
