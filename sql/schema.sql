-- sourcebound schema — run in the Supabase SQL editor.

-- 1. enable pgvector (Supabase ships it; this just turns it on)
create extension if not exists vector;

-- 2. source documents
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  source_name text not null,            -- e.g. "claude-api-guide.md"
  created_at  timestamptz default now()
);

-- 3. chunks with embeddings + provenance metadata
create table if not exists chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  source_name text not null,            -- denormalised for easy citation
  chunk_index int  not null,            -- position within the document
  content     text not null,
  embedding   vector(1536),             -- must match config.embedDim
  created_at  timestamptz default now()
);

-- 4. HNSW index for fast cosine similarity (best recall < 1M rows)
create index if not exists chunks_embedding_hnsw
  on chunks using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 5. similarity search function.
--    returns chunks ordered by similarity, filtered by a threshold.
--    similarity = 1 - cosine_distance, so higher = closer.
create or replace function match_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id           uuid,
  source_name  text,
  chunk_index  int,
  content      text,
  similarity   float
)
language sql stable
as $$
  select
    c.id,
    c.source_name,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding   -- <=> is cosine distance
  limit match_count;
$$;
