# Chunking & Ingestion Notes

The chunker splits a document into overlapping windows. It first splits on
paragraph boundaries, then packs paragraphs into windows sized by `chunkSize`
(approximately measured in tokens, using a rough four-characters-per-token
estimate). A single paragraph longer than the window is hard-split.

Overlap (`chunkOverlap`) carries a tail of the previous window into the next
one. This keeps a sentence that straddles a boundary from being cut in half,
which otherwise quietly wrecks retrieval quality.

Ingestion reads every `.md` or `.txt` file in a folder, chunks it, embeds the
chunks in a batch, and stores one `documents` row plus many `chunks` rows with
provenance. Query embeddings must use the same model as ingestion, or the
similarity scores are meaningless.

The default chunk size is 512 tokens with 64 tokens of overlap. Running the eval
at 256 versus 512 is the recommended experiment for tuning retrieval quality by
measurement rather than guessing.
