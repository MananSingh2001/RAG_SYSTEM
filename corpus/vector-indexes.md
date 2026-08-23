# Vector Indexes and Approximate Search

Once documents are embedded, the system needs a way to find the nearest vectors
to a query vector quickly. A brute-force scan compares the query against every
stored vector and is exact but slow as the corpus grows. Approximate nearest
neighbor (ANN) indexes trade a small amount of recall for a large speedup.

## HNSW

Hierarchical Navigable Small World (HNSW) builds a layered graph where each node
links to a few neighbors. Search starts at the top layer and greedily walks
toward the query, dropping down layers to refine. HNSW gives excellent recall
and low latency for corpora under a few million rows, at the cost of a one-time
build and higher memory use. Two parameters matter most: m controls how many
neighbors each node keeps, and ef_construction controls how hard the build works
to find good neighbors. A typical starting point is m = 16 and
ef_construction = 64.

## IVFFlat

Inverted File with Flat quantization (IVFFlat) clusters vectors into lists and
searches only the lists closest to the query. It builds faster and uses less
memory than HNSW but generally gives lower recall unless you probe many lists.
IVFFlat needs training data to form its clusters, so it should be built after
some vectors already exist.

## Choosing between them

For a knowledge base under a million rows where recall matters, HNSW is usually
the better default. For very large or frequently rebuilt corpora where memory is
tight, IVFFlat can be more economical. Both are exposed by pgvector in
PostgreSQL, so switching is a matter of changing the index definition, not the
application code.

## Filtering

Real systems often filter by metadata, such as document source or date, before
or during the vector search. Pre-filtering narrows the candidate set first;
post-filtering ranks by vector similarity and then discards non-matching rows.
Post-filtering can starve results if the filter is strict, so systems that need
hard filters often keep the metadata in the same row as the embedding.
