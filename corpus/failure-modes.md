# Common Failure Modes

Retrieval systems fail in characteristic ways. Knowing the catalog makes most
production incidents quick to diagnose.

## Hallucination

The model states something the sources do not support. The root cause is usually
weak retrieval feeding the generator plausible-but-irrelevant context, or a
prompt that does not firmly forbid outside knowledge. The defenses are a
similarity threshold that refuses on weak matches, a grounded prompt, and a
faithfulness metric that catches it in evaluation.

## Embedding dimension mismatch

If the index column is defined for one dimensionality and the model emits
another, inserts fail or, worse, comparisons silently misbehave. The fix is to
keep the schema's vector size, the model's output size, and the configuration's
declared dimension in agreement.

## Model drift between query and ingestion

If query embeddings are produced by a different model than the stored documents,
the vector spaces do not align and similarity collapses even though nothing
throws an error. Pinning one embedding model for both paths prevents it.

## Threshold mis-tuning

A threshold set too high filters out every match, so the system refuses every
question and every metric reads zero. Set too low, it admits noise and answer
quality falls. Because good thresholds depend on the embedding model, they must
be tuned against an evaluation set, not guessed.

## Oversized retrieval

A retrieval that returns too many passages can exceed the model's context window
or bury the relevant passage in noise. A context-budget cap that truncates
retrieval before the model call prevents both the crash and the quality loss.

## Empty or malformed output

Occasionally a generator returns an empty or malformed response. Validating the
output and substituting a safe fallback message keeps a broken response from
reaching the user as if it were an answer.
