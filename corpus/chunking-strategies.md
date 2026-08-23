# Chunking Strategies

Chunking splits a document into passages small enough to embed and retrieve
precisely, but large enough to carry self-contained meaning. It is one of the
highest-leverage decisions in a retrieval pipeline, because retrieval can only
ever return a whole chunk.

## Fixed-size windows

The simplest approach slices text into windows of a fixed token budget with a
fixed overlap. It is predictable and fast, but it can cut sentences and ideas
mid-thought. Overlap mitigates this by carrying a tail of each window into the
next, so a fact that straddles a boundary still appears intact in at least one
chunk.

## Recursive and structural splitting

A better approach splits on natural boundaries first, paragraphs, then
sentences, and only hard-splits when a single unit exceeds the window. This
keeps related text together and respects the document's structure. Splitting on
Markdown headings preserves section context, which is valuable because a heading
often states the topic the passage under it assumes.

## Semantic chunking

Semantic chunking places boundaries where the topic actually shifts, detected by
measuring the embedding distance between adjacent sentences. It produces
coherent passages but costs extra embedding calls at ingestion time, so it is
worth it mainly for heterogeneous documents that mix many topics.

## Overlap and size tradeoffs

Smaller chunks retrieve more precisely because each vector represents a tighter
idea, but they fragment context and multiply the number of vectors and embedding
tokens. Larger chunks preserve context but dilute the embedding, so a query can
match a chunk on a detail buried in mostly-irrelevant text. The only reliable
way to choose is to run the evaluation at several chunk sizes and compare
retrieval quality directly.

## Provenance

Every chunk should store where it came from: the source document, its position
within that document, and any section heading. This provenance is what lets an
answer carry a citation back to an exact passage, which is the difference
between a trustworthy system and a plausible-sounding one.
