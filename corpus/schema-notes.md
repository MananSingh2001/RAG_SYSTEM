# Schema & Retrieval Notes

docmind stores every document in a `documents` table and every chunk in a
`chunks` table. Each chunk keeps a foreign key to its parent document, the
denormalised `source_name`, and its `chunk_index` (position within the
document) so answers can cite exactly where a passage came from.

Embeddings are stored in a `vector(1536)` column, matching the
`text-embedding-3-small` model dimensionality. A single HNSW index built with
`vector_cosine_ops` (m = 16, ef_construction = 64) powers similarity search.
HNSW is chosen over IVFFlat because it gives better recall for corpora under
one million rows, at the cost of a one-time build.

The retriever uses cosine similarity. The `match_chunks` SQL function computes
similarity as `1 - cosine_distance`, so a higher score means a closer match. It
returns chunks ordered by distance, filtered by a `match_threshold`, limited to
`match_count` rows.
