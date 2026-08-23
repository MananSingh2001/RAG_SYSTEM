# Retrieval Strategies

Retrieval is the step that turns a user question into a small set of relevant
passages. The quality of everything downstream depends on it: a language model
can only ground its answer in what retrieval hands it.

## Dense vs sparse

Dense retrieval uses embeddings and vector similarity to match meaning. It
handles paraphrases and synonyms well but can miss exact terms like error codes,
product names, or rare identifiers. Sparse retrieval, such as BM25, matches
tokens and weights them by frequency; it excels at exact terms but is blind to
meaning. Each method fails where the other is strong.

## Hybrid search

Hybrid search runs both dense and sparse retrieval and merges the results. A
common merge is Reciprocal Rank Fusion (RRF), which scores each document by the
sum of one over its rank in each list. RRF needs no score calibration between
the two systems, which is why it is popular. Hybrid search reliably beats either
method alone on mixed workloads that contain both conceptual and exact-term
queries.

## Top-k and thresholds

Top-k sets how many passages retrieval returns. Too small and the answer may
lack context; too large and the model is distracted by noise and the context
budget is wasted. A similarity threshold sets a floor: passages below it are
treated as irrelevant. Together they let a system say "no coverage" honestly
when nothing clears the floor, instead of feeding the model weak matches and
inviting a hallucination.

## Tuning by measurement

The correct top-k and threshold depend on the embedding model and the corpus,
so they should be tuned with an evaluation set rather than guessed. A threshold
that is too high filters out good matches and produces false refusals; one that
is too low lets in noise and lowers answer quality. Measuring hit-rate at
several thresholds reveals the right operating point.
