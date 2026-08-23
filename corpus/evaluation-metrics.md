# Evaluation Metrics for Retrieval and Generation

A retrieval-augmented system has two halves that fail differently, so it needs
metrics for each: did retrieval find the right passages, and did generation use
them faithfully.

## Retrieval metrics

Hit-rate at k measures the fraction of questions whose correct source appears
anywhere in the top-k retrieved passages. It answers a blunt question: did we
retrieve the right thing at all? Mean Reciprocal Rank (MRR) is stricter; it
scores each question by one over the rank of the first correct result, so
placing the right passage first scores higher than placing it fifth. Normalized
Discounted Cumulative Gain (nDCG) generalizes this to graded relevance when some
passages are more relevant than others. Recall and precision describe how much
of the relevant material was found and how much of what was returned was
actually relevant.

## Generation metrics

Faithfulness measures whether the answer is supported by the retrieved context,
which is the direct test for hallucination. Answer relevance measures whether
the answer actually addresses the question. These are hard to compute with
string matching, so they are often scored by an LLM-as-judge: a separate model
instance reads the question, the answer, and the context and rates each on a
scale. Using a separate instance as judge reduces the risk of a model grading
its own work leniently.

## Golden sets

An evaluation needs a golden set: hand-written question and answer pairs, each
tagged with the source that should be retrieved and the key terms a correct
answer must contain. A small golden set of a dozen pairs is enough to catch
regressions; thirty to fifty pairs across the whole corpus give scores that are
stable enough to defend. The golden set should grow with the corpus so it keeps
exercising real coverage.

## Reproducibility

Scores are only meaningful alongside the configuration that produced them: the
embedding model, the generation model, the chunk size, the top-k, and the
similarity threshold. Recording these with every scorecard is what makes a
result reproducible and an improvement measurable.
