# Embeddings Deep Dive

An embedding is a fixed-length vector of floating-point numbers that represents
the meaning of a piece of text in a continuous space. Texts with similar meaning
map to vectors that sit close together, which is what makes semantic search
possible: instead of matching exact words, the retriever matches meaning.

## Dimensionality

The length of the vector is its dimensionality. A higher dimensionality can
capture more nuance but costs more storage and slightly more compute per
comparison. Common sizes range from 384 for small local models up to 3072 for
large hosted models. The model that produced an embedding fixes its
dimensionality; you cannot mix vectors of different sizes in the same index.

Some modern models use Matryoshka Representation Learning, which trains the
vector so that its leading prefix is itself a usable, lower-dimensional
embedding. This lets a single model emit 768, 1536, or 3072 dimensions on
request, trading a little quality for less storage.

## Similarity metrics

Cosine similarity measures the angle between two vectors and ignores their
magnitude, which makes it the default choice for text embeddings because it is
robust to differences in length. Dot product is cheaper but sensitive to
magnitude, so it is usually paired with normalized vectors. Euclidean distance
measures straight-line distance and is less common for text. When vectors are
L2-normalized, cosine similarity and dot product rank results identically.

## Normalization and consistency

Query embeddings must be produced by the exact same model as the stored document
embeddings. If the query model differs from the ingestion model, the two vector
spaces do not align and similarity scores become meaningless even though the
math still runs. This "model drift" is one of the most common silent bugs in a
retrieval pipeline: nothing errors, but relevance collapses.

## Batching and cost

Embedding APIs accept many texts per request. Batching amortizes network
overhead and is far faster than embedding one string at a time. Because
providers bill per token, chunking strategy directly drives embedding cost:
smaller chunks mean more vectors and more tokens embedded overall.
